import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Document as PrismaDocument } from '@prisma/client';

export interface IDocument extends PrismaDocument, IBaseDocument {}

export const Document = createPrismaModel<IDocument>(
  'Document',
  () => prisma.document,
  {
    beforeCreate: (data: any) => {
      if (data.provider === undefined) data.provider = 'local';
      if (data.isDeleted === undefined) data.isDeleted = false;
      return data;
    },
  }
);

export default Document;
