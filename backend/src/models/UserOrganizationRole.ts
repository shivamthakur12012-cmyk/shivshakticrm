import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { UserOrganizationRole as PrismaUserOrganizationRole } from '@prisma/client';

export interface IUserOrganizationRole extends PrismaUserOrganizationRole, IBaseDocument {}

export const UserOrganizationRole = createPrismaModel<IUserOrganizationRole>(
  'UserOrganizationRole',
  () => prisma.userOrganizationRole
);
export default UserOrganizationRole;
