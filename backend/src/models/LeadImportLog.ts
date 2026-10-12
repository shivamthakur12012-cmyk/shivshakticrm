import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { LeadImportLog as PrismaLeadImportLog } from '@prisma/client';

export interface ILeadImportRowError {
  rowNumber: number;
  phone?: string;
  email?: string;
  name?: string;
  reason: string;
}

export interface ILeadImportDuplicate {
  rowNumber: number;
  phone?: string;
  email?: string;
  name?: string;
  existingLeadId: string;
  resolution: 'skipped' | 'merged' | 'created_new' | 'pending';
}

export interface ILeadImportLog extends Omit<PrismaLeadImportLog, 'rowErrors' | 'duplicates'>, IBaseDocument {
  rowErrors: ILeadImportRowError[];
  duplicates: ILeadImportDuplicate[];
}

export const LeadImportLog = createPrismaModel<ILeadImportLog>(
  'LeadImportLog',
  () => prisma.leadImportLog,
  {
    beforeCreate: (data: any) => {
      if (data.status === undefined) data.status = 'completed';
      if (data.totalRows === undefined) data.totalRows = 0;
      if (data.successfulRows === undefined) data.successfulRows = 0;
      if (data.failedRows === undefined) data.failedRows = 0;
      if (data.duplicateRows === undefined) data.duplicateRows = 0;
      return data;
    },
  }
);

export default LeadImportLog;
