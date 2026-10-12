import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Lead as PrismaLead } from '@prisma/client';

export interface ILead extends PrismaLead, IBaseDocument {
  assignedUser?: any;
}

export const Lead = createPrismaModel<ILead>(
  'Lead',
  () => prisma.lead,
  {
    beforeCreate: async (data: any) => {
      // 1. Calculate Score & Category
      let computedScore = 0;
      if (data.email) computedScore += 10;
      if (data.phone) computedScore += 10;
      if (data.serviceInterested || data.productInterested) computedScore += 20;
      if (data.expectedValue && data.expectedValue >= 50000) computedScore += 20;
      if (data.whatsApp) computedScore += 15;
      if (data.notes && data.notes.length > 20) computedScore += 10;
      if (data.nextFollowUp) computedScore += 15;

      data.score = computedScore;
      if (computedScore <= 30) {
        data.scoreCategory = 'cold';
      } else if (computedScore <= 60) {
        data.scoreCategory = 'warm';
      } else if (computedScore <= 80) {
        data.scoreCategory = 'hot';
      } else {
        data.scoreCategory = 'very_hot';
      }

      // 2. Auto-generate sequential leadId if missing
      if (!data.leadId && data.organizationId) {
        const count = await prisma.lead.count({ where: { organizationId: data.organizationId } });
        data.leadId = `LD-${10001 + count}`;
      }

      // Ensure default values
      if (data.isDeleted === undefined) data.isDeleted = false;
      if (data.version === undefined) data.version = 1;

      return data;
    },
  }
);

export default Lead;
