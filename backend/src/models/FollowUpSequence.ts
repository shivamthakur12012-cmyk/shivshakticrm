import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { FollowUpSequence as PrismaFollowUpSequence, SequenceStep as PrismaSequenceStep } from '@prisma/client';

export interface ISequenceStep extends PrismaSequenceStep {
  _id?: string;
}

export interface IFollowUpSequence extends PrismaFollowUpSequence, IBaseDocument {
  steps?: ISequenceStep[];
}

export const FollowUpSequence = createPrismaModel<IFollowUpSequence>(
  'FollowUpSequence',
  () => prisma.followUpSequence,
  {
    beforeCreate: (data: any) => {
      if (data.isActive === undefined) data.isActive = true;
      if (data.isDefault === undefined) data.isDefault = false;
      if (data.stopOnReply === undefined) data.stopOnReply = true;
      if (data.stopOnConversion === undefined) data.stopOnConversion = true;
      if (data.steps && Array.isArray(data.steps)) {
        data.steps = {
          create: data.steps.map((st: any, idx: number) => ({
            stepNumber: st.stepNumber !== undefined ? st.stepNumber : idx + 1,
            delayDays: st.delayDays !== undefined ? st.delayDays : 0,
            delayHours: st.delayHours !== undefined ? st.delayHours : 0,
            channel: st.channel || 'whatsapp',
            actionType:
              st.actionType ||
              (st.channel === 'email'
                ? 'send_email'
                : st.channel === 'phone'
                  ? 'create_call_task'
                  : 'send_message'),
            title: st.title || `Step ${idx + 1}`,
            templateSubject: st.templateSubject || st.subject || null,
            templateBody: st.templateBody || st.content || null,
            callObjective: st.callObjective || null,
            talkingPoints: st.talkingPoints || [],
            priority: st.priority || 'medium',
          })),
        };
      }
      return data;
    },
  }
);

export default FollowUpSequence;