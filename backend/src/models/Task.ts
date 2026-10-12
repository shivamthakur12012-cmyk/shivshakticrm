import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Task as PrismaTask } from '@prisma/client';

export interface ITask extends PrismaTask, IBaseDocument {}

export const Task = createPrismaModel<ITask>(
  'Task',
  () => prisma.task,
  {
    beforeCreate: (data: any) => {
      if (data.status === undefined) data.status = 'pending';
      if (data.priority === undefined) data.priority = 'medium';
      return data;
    },
  }
);

export default Task;
