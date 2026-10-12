import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Deal as PrismaDeal } from '@prisma/client';

export interface IDeal extends PrismaDeal, IBaseDocument {}

export const Deal = createPrismaModel<IDeal>(
  'Deal',
  () => prisma.deal,
  {
    beforeCreate: async (data: any) => {
      if (!data.dealId && data.organizationId) {
        const count = await prisma.deal.count({ where: { organizationId: data.organizationId } });
        data.dealId = `DL-${10001 + count}`;
      }
      if (data.isDeleted === undefined) data.isDeleted = false;
      if (data.amount === undefined) data.amount = 0;
      if (data.probability === undefined) data.probability = 0;
      if (data.status === undefined) data.status = 'open';
      return data;
    },
  }
);

export default Deal;
