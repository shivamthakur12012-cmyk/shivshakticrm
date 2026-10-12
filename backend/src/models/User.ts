import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { User as PrismaUser } from '@prisma/client';

export interface IUser extends PrismaUser, IBaseDocument {}

export const User = createPrismaModel<IUser>('User', () => prisma.user);
export default User;
