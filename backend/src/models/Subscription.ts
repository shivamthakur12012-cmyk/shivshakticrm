import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Subscription as PrismaSubscription } from '@prisma/client';
import { IPlanLimits, IPlanFeatures } from './Plan';

export interface ISubscription extends Omit<PrismaSubscription, 'limitsAtPurchase' | 'featuresAtPurchase'>, IBaseDocument {
  limitsAtPurchase: IPlanLimits;
  featuresAtPurchase: IPlanFeatures;
}

export const Subscription = createPrismaModel<ISubscription>(
  'Subscription',
  () => prisma.subscription,
  {
    beforeCreate: (data: any) => {
      if (data.status === undefined) data.status = 'active';
      if (data.paymentStatus === undefined) data.paymentStatus = 'free';
      if (data.paymentProvider === undefined) data.paymentProvider = 'free';
      if (data.gracePeriodDays === undefined) data.gracePeriodDays = 7;
      if (data.autoRenew === undefined) data.autoRenew = false;
      if (data.maxUsersAtPurchase !== undefined) {
        data.userSeatsLimit = data.maxUsersAtPurchase;
      }
      if (data.limitsAtPurchase?.invoices !== undefined) {
        data.invoicesCountLimit = data.limitsAtPurchase.invoices;
      }
      return data;
    },
  }
);

export default Subscription;
