import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Role as PrismaRole } from '@prisma/client';

export interface IRole extends PrismaRole, IBaseDocument {
  permissions?: any[];
}

export const Role = createPrismaModel<IRole>(
  'Role',
  () => prisma.role,
  {
    beforeCreate: (data: any) => {
      if (data.permissions && Array.isArray(data.permissions)) {
        const pIds = data.permissions
          .map((p: any) => (typeof p === 'object' && p ? p.id || p._id : p))
          .filter(Boolean);
        data.permissions = {
          create: pIds.map((permissionId: string) => ({ permissionId })),
        };
      }
      return data;
    },
  }
);

export default Role;
