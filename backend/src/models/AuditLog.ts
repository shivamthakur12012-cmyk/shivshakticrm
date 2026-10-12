import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { AuditLog as PrismaAuditLog } from '@prisma/client';

export interface IAuditLog extends PrismaAuditLog, IBaseDocument {}

export const AuditLog = createPrismaModel<IAuditLog>('AuditLog', () => prisma.auditLog);
export default AuditLog;
