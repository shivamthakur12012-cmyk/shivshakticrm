import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { CommunicationConsent as PrismaCommunicationConsent } from '@prisma/client';

export interface ICommunicationConsent extends PrismaCommunicationConsent, IBaseDocument {}

export const CommunicationConsent = createPrismaModel<ICommunicationConsent>(
  'CommunicationConsent',
  () => prisma.communicationConsent
);
export default CommunicationConsent;
