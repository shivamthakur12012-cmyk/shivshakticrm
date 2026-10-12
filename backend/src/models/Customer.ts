import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Customer as PrismaCustomer } from '@prisma/client';

export interface ICustomer extends PrismaCustomer, IBaseDocument {}

export const Customer = createPrismaModel<ICustomer>(
  'Customer',
  () => prisma.customer,
  {
    beforeCreate: async (data: any) => {
      // Auto-generate sequential customerId if missing
      if (!data.customerId && data.organizationId) {
        const count = await prisma.customer.count({ where: { organizationId: data.organizationId } });
        data.customerId = `CS-${10001 + count}`;
      }
      if (data.isDeleted === undefined) data.isDeleted = false;
      if (data.outstandingBalance === undefined) data.outstandingBalance = 0;
      return data;
    },
  }
);
export default Customer;
