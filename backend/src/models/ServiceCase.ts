import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { ServiceCase as PrismaServiceCase } from '@prisma/client';

export interface ICaseChecklistItem {
  _id?: string;
  id?: string;
  name: string;
  isRequired: boolean;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  documentId?: string;
  uploadedAt?: Date;
  reviewerNotes?: string;
}

export interface IServiceCase extends Omit<PrismaServiceCase, 'checklist'>, IBaseDocument {
  checklist?: ICaseChecklistItem[];
}

export const ServiceCase = createPrismaModel<IServiceCase>(
  'ServiceCase',
  () => prisma.serviceCase,
  {
    beforeCreate: async (data: any) => {
      if (!data.caseId && data.organizationId) {
        const count = await prisma.serviceCase.count({ where: { organizationId: data.organizationId } });
        data.caseId = `SC-${10001 + count}`;
      }
      if (data.stage === undefined) data.stage = 'created';
      if (data.checklist && Array.isArray(data.checklist)) {
        data.checklist = {
          create: data.checklist.map((c: any) => ({
            name: c.name,
            isRequired: c.isRequired !== undefined ? c.isRequired : true,
            status: c.status || 'pending',
            documentId: c.documentId,
            uploadedAt: c.uploadedAt,
            reviewerNotes: c.reviewerNotes,
          })),
        };
      }
      return data;
    },
  }
);

export default ServiceCase;
