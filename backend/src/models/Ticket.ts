import prisma from '../config/prisma';
import { createPrismaModel, IBaseDocument } from './prismaAdapter';
import { Ticket as PrismaTicket } from '@prisma/client';

export interface ITicketMessage {
  _id?: string;
  id?: string;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'customer';
  content: string;
  date: Date;
}

export interface ITicket extends Omit<PrismaTicket, 'messages'>, IBaseDocument {
  messages?: ITicketMessage[];
}

export const Ticket = createPrismaModel<ITicket>(
  'Ticket',
  () => prisma.ticket,
  {
    beforeCreate: async (data: any) => {
      if (!data.ticketId && data.organizationId) {
        const count = await prisma.ticket.count({ where: { organizationId: data.organizationId } });
        data.ticketId = `TKT-${10001 + count}`;
      }
      if (data.isDeleted === undefined) data.isDeleted = false;
      if (data.status === undefined) data.status = 'open';
      if (data.priority === undefined) data.priority = 'medium';
      if (data.category === undefined) data.category = 'technical';
      if (data.messages && Array.isArray(data.messages)) {
        data.messages = {
          create: data.messages.map((m: any) => ({
            senderId: m.senderId,
            senderName: m.senderName,
            senderType: m.senderType || 'user',
            content: m.content || '',
            date: m.date ? new Date(m.date) : new Date(),
          })),
        };
      }
      return data;
    },
  }
);

export default Ticket;
