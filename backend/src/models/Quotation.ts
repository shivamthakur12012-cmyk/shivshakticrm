import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Quotation as PrismaQuotation } from '@prisma/client';

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted';

export interface IQuotationLineItem {
  _id?: string;
  id?: string;
  itemId?: string;
  name: string;
  description?: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  gstRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
}

export interface IQuotation extends Omit<PrismaQuotation, 'items'>, IBaseDocument {
  items?: IQuotationLineItem[];
}

export function calculateQuotationTotals(items: IQuotationLineItem[]) {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxTotal = 0;

  const calculatedItems = items.map((item) => {
    const itemSubtotalRaw = item.quantity * item.rate;
    const discountAmount =
      item.discountPercent > 0
        ? Math.round(itemSubtotalRaw * (item.discountPercent / 100) * 100) / 100
        : item.discountAmount || 0;

    const itemSubtotal = Math.max(0, itemSubtotalRaw - discountAmount);
    const taxAmount = Math.round(itemSubtotal * (item.gstRate / 100) * 100) / 100;
    const itemTotal = itemSubtotal + taxAmount;

    subtotal += itemSubtotalRaw;
    totalDiscount += discountAmount;
    taxTotal += taxAmount;

    return {
      ...item,
      discountAmount,
      subtotal: itemSubtotal,
      taxAmount,
      total: itemTotal,
    };
  });

  const grandTotal = Math.round((subtotal - totalDiscount + taxTotal) * 100) / 100;

  return {
    items: calculatedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    totalAmount: grandTotal,
  };
}

export const Quotation = createPrismaModel<IQuotation>(
  'Quotation',
  () => prisma.quotation,
  {
    beforeCreate: async (data: any) => {
      // 1. Ensure date and validUntil are proper Date objects
      if (data.date) {
        data.date = new Date(data.date);
      } else {
        data.date = new Date();
      }

      if (data.validUntil) {
        data.validUntil = new Date(data.validUntil);
      } else {
        data.validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      // 2. Calculate items & totals
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const calc = calculateQuotationTotals(data.items);
        data.subtotal = calc.subtotal;
        data.totalDiscount = calc.totalDiscount;
        data.taxTotal = calc.taxTotal;
        data.totalAmount = calc.totalAmount;
        data.items = {
          create: calc.items.map((it: any) => ({
            itemId: it.itemId || undefined,
            name: it.name,
            description: it.description || null,
            quantity: Number(it.quantity || 1),
            rate: Number(it.rate || 0),
            discountPercent: Number(it.discountPercent || 0),
            discountAmount: Number(it.discountAmount || 0),
            gstRate: Number(it.gstRate || 18),
            taxAmount: Number(it.taxAmount || 0),
            subtotal: Number(it.subtotal || 0),
            total: Number(it.total || 0),
          })),
        };
      }

      // 3. Sequential ID
      if (!data.quotationId && data.organizationId) {
        const count = await prisma.quotation.count({ where: { organizationId: data.organizationId } });
        data.quotationId = `QT-${10001 + count}`;
      }

      if (data.isDeleted === undefined) data.isDeleted = false;
      if (data.version === undefined) data.version = 1;
      if (data.status === undefined) data.status = 'draft';

      return data;
    },
  }
);

export default Quotation;