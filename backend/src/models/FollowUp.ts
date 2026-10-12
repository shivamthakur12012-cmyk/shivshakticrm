import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { FollowUp as PrismaFollowUp } from '@prisma/client';

export type FollowUpChannel = 'whatsapp' | 'email' | 'instagram' | 'phone';

export interface IFollowUp extends PrismaFollowUp, IBaseDocument {}

export const FollowUp = createPrismaModel<IFollowUp>(
  'FollowUp',
  () => prisma.followUp,
  {
    beforeCreate: (data: any) => {
      if (data.type === 'call') {
        data.channel = 'phone';
        data.type = 'phone';
      } else if (!data.channel && data.type) {
        data.channel = data.type;
      }
      if (!data.type) {
        data.type = data.channel || 'phone';
      }
      if (data.status === undefined) data.status = 'pending';
      if (data.priority === undefined) data.priority = 'medium';
      return data;
    },
  }
);

export default FollowUp;
