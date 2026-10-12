import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Pipeline as PrismaPipeline, PipelineStage as PrismaPipelineStage } from '@prisma/client';

export interface IPipelineStage extends PrismaPipelineStage {
  _id?: string;
}

export interface IPipeline extends PrismaPipeline, IBaseDocument {
  stages?: IPipelineStage[];
}

export const Pipeline = createPrismaModel<IPipeline>(
  'Pipeline',
  () => prisma.pipeline,
  {
    beforeCreate: (data: any) => {
      if (data.stages && Array.isArray(data.stages)) {
        data.stages = {
          create: data.stages.map((s: any, idx: number) => ({
            name: s.name,
            probability: s.probability !== undefined ? s.probability : 0,
            order: s.order !== undefined ? s.order : idx,
            color: s.color,
          })),
        };
      }
      return data;
    },
  }
);

export default Pipeline;
