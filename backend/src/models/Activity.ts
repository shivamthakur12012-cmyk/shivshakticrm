import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Activity as PrismaActivity } from '@prisma/client';

export interface IActivity extends PrismaActivity, IBaseDocument {}

export const Activity = createPrismaModel<IActivity>('Activity', () => prisma.activity);
export default Activity;
