import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Workflow as PrismaWorkflow } from '@prisma/client';

export interface IWorkflowCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than';
  value: string;
}

export interface IWorkflowAction {
  actionType: 'send_email' | 'create_task';
  metadata: Record<string, any>;
}

export interface IWorkflow extends Omit<PrismaWorkflow, 'conditions' | 'actions'>, IBaseDocument {
  conditions: IWorkflowCondition[];
  actions: IWorkflowAction[];
}

export const Workflow = createPrismaModel<IWorkflow>(
  'Workflow',
  () => prisma.workflow,
  {
    beforeCreate: (data: any) => {
      if (data.isActive === undefined) data.isActive = true;
      if (data.isDeleted === undefined) data.isDeleted = false;
      return data;
    },
  }
);

export default Workflow;
