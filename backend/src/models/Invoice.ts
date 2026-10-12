import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Invoice as PrismaInvoice } from '@prisma/client';

export interface IInvoiceLineItem {
  _id?: string;
  id?: string;
  itemId?: string;
  name: string;
  quantity: number;
  rate: number;
  gstRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
}

export interface IInvoicePayment {
  _id?: string;
  id?: string;
  amount: number;
  reference: string;
  date: Date;
  method: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card';
}

export interface IInvoice extends Omit<PrismaInvoice, 'items' | 'payments'>, IBaseDocument {
  items?: IInvoiceLineItem[];
  payments?: IInvoicePayment[];
}

export const Invoice = createPrismaModel<IInvoice>(
  'Invoice',
  () => prisma.invoice,
  {
    beforeCreate: async (data: any) => {
      // 1. Ensure date and dueDate are proper Date objects
      if (data.date) {
        data.date = new Date(data.date);
      } else {
        data.date = new Date();
      }

      if (data.dueDate) {
        data.dueDate = new Date(data.dueDate);
      } else {
        data.dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      }

      // 2. Auto generate sequential ID
      if (!data.invoiceId && data.organizationId) {
        const count = await prisma.invoice.count({ where: { organizationId: data.organizationId } });
        data.invoiceId = `INV-${10001 + count}`;
      }

      // 3. Calculate payments sum and outstanding balance
      const rawPayments = Array.isArray(data.payments) ? data.payments : [];
      const paidSum = rawPayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
      data.amountPaid = Math.round(paidSum * 100) / 100;
      data.outstandingBalance = Math.max(0, Math.round(((data.totalAmount || 0) - data.amountPaid) * 100) / 100);

      if (data.totalAmount > 0) {
        if (data.outstandingBalance <= 0) {
          data.status = 'paid';
        } else if (data.amountPaid > 0) {
          data.status = 'partial';
        }
      }

      if (data.isDeleted === undefined) data.isDeleted = false;
      if (data.isLocked === undefined) data.isLocked = false;
      if (data.status === undefined) data.status = 'draft';

      if (data.items && Array.isArray(data.items)) {
        data.items = {
          create: data.items.map((it: any) => ({
            itemId: it.itemId || undefined,
            name: it.name,
            quantity: Number(it.quantity || 1),
            rate: Number(it.rate || 0),
            gstRate: Number(it.gstRate || 18),
            taxAmount: Number(it.taxAmount || 0),
            subtotal: Number(it.subtotal || 0),
            total: Number(it.total || 0),
          })),
        };
      }

      if (data.payments && Array.isArray(data.payments)) {
        data.payments = {
          create: data.payments.map((p: any) => ({
            amount: Number(p.amount || 0),
            reference: p.reference || '',
            date: p.date ? new Date(p.date) : new Date(),
            method: p.method || 'cash',
          })),
        };
      }

      return data;
    },
  }
);

export default Invoice;
