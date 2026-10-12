import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { SaaSAuditLog as PrismaSaaSAuditLog } from '@prisma/client';

export interface ISaaSAuditLog extends PrismaSaaSAuditLog, IBaseDocument {}

export const SaaSAuditLog = createPrismaModel<ISaaSAuditLog>('SaaSAuditLog', () => prisma.saaSAuditLog);
export default SaaSAuditLog;
