import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Permission as PrismaPermission } from '@prisma/client';

export interface IPermission extends PrismaPermission, IBaseDocument {}

export const Permission = createPrismaModel<IPermission>('Permission', () => prisma.permission);
export default Permission;
