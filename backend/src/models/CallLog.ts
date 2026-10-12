import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { CallLog as PrismaCallLog } from '@prisma/client';

export type CallOutcome =
  | 'Connected'
  | 'Interested'
  | 'Not Interested'
  | 'Call Back Later'
  | 'Busy'
  | 'No Answer'
  | 'Switched Off'
  | 'Wrong Number'
  | 'Converted'
  | 'Follow-up Required'
  | 'Other';

export interface ICallLog extends Omit<PrismaCallLog, 'aiBrief' | 'aiAnalysis'>, IBaseDocument {
  aiBrief?: any;
  aiAnalysis?: any;
}

export const CallLog = createPrismaModel<ICallLog>(
  'CallLog',
  () => prisma.callLog,
  {
    beforeCreate: (data: any) => {
      if (data.direction === undefined) data.direction = 'outbound';
      if (data.provider === undefined) data.provider = 'manual';
      if (data.status === undefined) data.status = 'completed';
      if (data.outcome === undefined) data.outcome = 'Connected';
      if (data.duration === undefined) data.duration = 0;
      return data;
    },
  }
);

export default CallLog;
