import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Session as PrismaSession } from '@prisma/client';

export interface ISession extends PrismaSession, IBaseDocument {}

export const Session = createPrismaModel<ISession>('Session', () => prisma.session);
export default Session;
