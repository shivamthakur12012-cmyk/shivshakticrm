import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Organization as PrismaOrganization } from '@prisma/client';

export interface IOrganization extends PrismaOrganization, IBaseDocument {}

export const Organization = createPrismaModel<IOrganization>('Organization', () => prisma.organization);
export default Organization;
