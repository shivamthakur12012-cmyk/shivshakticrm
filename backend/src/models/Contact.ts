import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Contact as PrismaContact } from '@prisma/client';

export interface IContact extends PrismaContact, IBaseDocument {}

export const Contact = createPrismaModel<IContact>('Contact', () => prisma.contact);
export default Contact;
