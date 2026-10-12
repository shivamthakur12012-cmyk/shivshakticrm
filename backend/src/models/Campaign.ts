import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Campaign as PrismaCampaign } from '@prisma/client';

export interface ICampaign extends Omit<PrismaCampaign, 'targetCriteria' | 'content' | 'stats'>, IBaseDocument {
  targetCriteria?: any;
  content?: any;
  stats?: any;
}

export const Campaign = createPrismaModel<ICampaign>(
  'Campaign',
  () => prisma.campaign,
  {
    beforeCreate: (data: any) => {
      if (data.status === undefined) data.status = 'draft';
      if (data.type === undefined) data.type = 'broadcast';
      if (!data.stats) {
        data.stats = {
          totalTargeted: 0,
          sentOrCreated: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          connected: 0,
          interested: 0,
          converted: 0,
          failedOrBounced: 0,
        };
      }
      return data;
    },
  }
);

export default Campaign;
