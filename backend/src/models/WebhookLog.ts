import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { WebhookLog as PrismaWebhookLog } from '@prisma/client';

export interface IWebhookLog extends PrismaWebhookLog, IBaseDocument {}

export const WebhookLog = createPrismaModel<IWebhookLog>(
  'WebhookLog',
  () => prisma.webhookLog,
  {
    beforeCreate: (data: any) => {
      if (data.status === undefined) data.status = 'processed';
      if (data.provider === undefined) data.provider = 'system';
      return data;
    },
  }
);

export default WebhookLog;
