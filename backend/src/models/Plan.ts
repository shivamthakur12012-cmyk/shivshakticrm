import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Plan as PrismaPlan } from '@prisma/client';

export interface IPlanLimits {
  leads: number;
  contacts: number;
  campaigns: number;
  followUps: number;
  tasks: number;
  invoices: number;
  storageMb: number;
}

export interface IPlanFeatures {
  email: boolean;
  whatsapp: boolean;
  instagram: boolean;
  phoneCalls: boolean;
  analytics: boolean;
  reports: boolean;
  automation: boolean;
  aiCopilot: boolean;
}

export interface IPlan extends Omit<PrismaPlan, 'limits' | 'features'>, IBaseDocument {
  limits: IPlanLimits;
  features: IPlanFeatures;
}

export const Plan = createPrismaModel<IPlan>(
  'Plan',
  () => prisma.plan,
  {
    beforeCreate: (data: any) => {
      if (data.isActive === undefined) data.isActive = true;
      if (data.price === undefined) data.price = 0;
      if (data.currency === undefined) data.currency = 'INR';
      if (data.duration === undefined) data.duration = 30;
      if (data.durationUnit === undefined) data.durationUnit = 'days';
      if (data.maxUsers === undefined) data.maxUsers = 3;
      if (data.sortOrder === undefined) data.sortOrder = 0;
      return data;
    },
  }
);

export default Plan;
