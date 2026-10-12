import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { AssignmentLog as PrismaAssignmentLog } from '@prisma/client';

export interface IAssignmentLog extends PrismaAssignmentLog, IBaseDocument {}

export const AssignmentLog = createPrismaModel<IAssignmentLog>('AssignmentLog', () => prisma.assignmentLog);
export default AssignmentLog;
