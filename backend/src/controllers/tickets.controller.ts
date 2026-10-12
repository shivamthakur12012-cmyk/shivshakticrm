import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { Ticket } from '../models/Ticket';
import { Customer } from '../models/Customer';
import { Contact } from '../models/Contact';
import { Activity } from '../models/Activity';
import { User } from '../models/User';
import { WorkflowService } from '../services/workflow.service';

// Helper to check if the current user is a Client, and return their customerId link
async function getClientCustomerId(orgId: string, email?: string): Promise<string | null> {
  if (!email) return null;
  // Check if email matches customer directory email or contact email
  const customer = await Customer.findOne({ organizationId: orgId, email, isDeleted: false });
  if (customer) return String(customer._id || customer.id);

  const contact = await Contact.findOne({ organizationId: orgId, email, isDeleted: false });
  if (contact) return String(contact.customerId);

  return null;
}

export async function getTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userEmail = req.user?.email;
    const isSuperAdmin = userEmail === 'shivamthakur12012@gmail.com' || (req.user as any)?.role === 'Super Admin';
    const { status, priority, category, organizationId } = req.query;

    const query: any = { isDeleted: false };
    if (!isSuperAdmin) {
      query.organizationId = orgId;
    } else if (organizationId && organizationId !== 'all') {
      query.organizationId = organizationId;
    }

    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (category && category !== 'all') query.category = category;

    // Enforce Client Isolation
    if (!isSuperAdmin && orgId) {
      const clientCustomerId = await getClientCustomerId(orgId as string, userEmail);
      if (clientCustomerId) {
        query.customerId = clientCustomerId;
      }
    }

    const tickets = await Ticket.find(query)
      .populate('customerId', 'name companyName email phone')
      .populate('assignedTo', 'firstName lastName')
      .populate('organizationId', 'name logoUrl')
      .sort({ updatedAt: -1, createdAt: -1 });

    return res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    next(error);
  }
}

export async function getTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userEmail = req.user?.email;
    const isSuperAdmin = userEmail === 'shivamthakur12012@gmail.com' || (req.user as any)?.role === 'Super Admin';
    const { id } = req.params;

    const query: any = { _id: id, isDeleted: false };
    if (!isSuperAdmin) {
      query.organizationId = orgId;
    }

    const ticket = await Ticket.findOne(query)
      .populate('customerId', 'name companyName email phone')
      .populate('assignedTo', 'firstName lastName')
      .populate('organizationId', 'name logoUrl');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    // Enforce Client Isolation
    if (!isSuperAdmin && orgId) {
      const clientCustomerId = await getClientCustomerId(orgId as string, userEmail);
      if (clientCustomerId && String((ticket.customerId as any)?._id || (ticket.customerId as any)?.id || ticket.customerId) !== clientCustomerId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to this ticket.',
          errorCode: 'FORBIDDEN'
        });
      }
    }

    return res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
}

// Public Issue Report (No login required - for client self-service portal / link)
export async function submitPublicIssueReport(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      organizationId,
      name,
      email,
      phone,
      companyName,
      title,
      description,
      category = 'technical',
      priority = 'medium'
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Issue title and detailed description are required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Resolve or find default organization if not provided
    let targetOrgId = organizationId;
    if (!targetOrgId) {
      const anyCust = await Customer.findOne({ isDeleted: false });
      targetOrgId = anyCust ? anyCust.organizationId : null;
    }

    if (!targetOrgId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace organization could not be resolved.',
        errorCode: 'ORG_NOT_FOUND'
      });
    }

    // Find or create customer
    let customer = null;
    if (email || phone) {
      const orClauses: any[] = [];
      if (email) orClauses.push({ email });
      if (phone) orClauses.push({ phone });
      customer = await Customer.findOne({ organizationId: targetOrgId, isDeleted: false, $or: orClauses });
    }

    if (!customer) {
      customer = await Customer.create({
        organizationId: targetOrgId,
        name: name || 'Client User',
        companyName: companyName || '',
        email: email || (phone ? `${phone}@client.local` : 'client@local.com'),
        phone: phone || '0000000000'
      });
    }

    const messages = [{
      senderId: String(customer._id),
      senderName: name || customer.name || 'Client',
      senderType: 'customer' as const,
      content: description,
      date: new Date()
    }];

    const ticket = await Ticket.create({
      organizationId: targetOrgId,
      customerId: customer._id,
      title,
      description,
      priority,
      category,
      status: 'open',
      messages
    });

    // Log activity
    await Activity.create({
      organizationId: targetOrgId,
      customerId: customer._id,
      type: 'note',
      content: `🚨 Direct Client Issue Reported: "${title}" (Ticket: ${ticket.ticketId}) under ${category.toUpperCase()}`
    });

    return res.status(201).json({
      success: true,
      message: 'Your issue has been reported successfully. Our team has received your ticket.',
      data: {
        ticketId: ticket.ticketId,
        id: ticket._id,
        status: ticket.status,
        createdAt: ticket.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createTicket(req: Request, res: Response, next: NextFunction) {
  try {
    let orgId = req.organizationId;
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const isSuperAdmin = userEmail === 'shivamthakur12012@gmail.com' || (req.user as any)?.role === 'Super Admin';

    let userName = isSuperAdmin ? 'Platform Super Admin' : 'Client Contact';
    if (userId) {
      const userDoc = await User.findById(userId);
      if (userDoc) {
        userName = `${userDoc.firstName} ${userDoc.lastName}`.trim() || userName;
      }
    }

    const { title, description, priority = 'medium', category = 'technical', customerId: reqCustomerId, clientName, clientEmail, clientPhone } = req.body;

    // Fallback organization for Super Admin if orgId is not set
    if (!orgId) {
      const anyCust = await Customer.findOne({ isDeleted: false });
      if (anyCust) {
        orgId = anyCust.organizationId;
      }
    }

    let customerId = reqCustomerId;

    // Enforce Client Isolation on creation
    if (!isSuperAdmin && orgId) {
      const clientCustomerId = await getClientCustomerId(orgId as string, userEmail);
      if (clientCustomerId) {
        customerId = clientCustomerId;
      }
    }

    // Auto-resolve or create customer if not explicitly passed
    if (!customerId && (clientName || clientEmail || clientPhone)) {
      let cust = null;
      if (clientEmail) {
        cust = await Customer.findOne({ organizationId: orgId, email: clientEmail, isDeleted: false });
      }
      if (!cust && clientPhone) {
        cust = await Customer.findOne({ organizationId: orgId, phone: clientPhone, isDeleted: false });
      }
      if (!cust) {
        cust = await Customer.create({
          organizationId: orgId,
          name: clientName || 'Direct Client',
          email: clientEmail || (clientPhone ? `${clientPhone}@client.local` : 'client@local.com'),
          phone: clientPhone || '0000000000'
        });
      }
      customerId = cust._id;
    }

    if (!customerId) {
      // Fallback to first active customer or create default
      const defaultCust = await Customer.findOne({ organizationId: orgId, isDeleted: false });
      if (defaultCust) {
        customerId = defaultCust._id;
      } else {
        const created = await Customer.create({
          organizationId: orgId,
          name: 'General Client',
          email: 'general@client.local',
          phone: '0000000000'
        });
        customerId = created._id;
      }
    }

    // Initialize messages list with the ticket description
    const messages = [{
      senderId: String(userId || 'support'),
      senderName: userName,
      senderType: 'user' as const,
      content: description,
      date: new Date()
    }];

    const ticket = await Ticket.create({
      organizationId: orgId,
      customerId,
      title,
      description,
      priority,
      category,
      status: 'open',
      messages
    });

    // Log Activity
    await Activity.create({
      organizationId: orgId,
      customerId,
      userId,
      type: 'note',
      content: `Ticket "${title}" opened (Ticket ID: ${ticket.ticketId}) under category "${category.toUpperCase()}".`
    });

    // Trigger automation workflows
    await WorkflowService.triggerWorkflows(orgId as string, 'ticket_created', ticket);

    // Re-fetch populated ticket
    const targetId = String(ticket.id || ticket._id);
    const populatedTicket = await Ticket.findOne({ _id: targetId })
      .populate('customerId', 'name companyName email phone')
      .populate('assignedTo', 'firstName lastName')
      .populate('organizationId', 'name logoUrl');

    return res.status(201).json({
      success: true,
      data: populatedTicket || ticket
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userEmail = req.user?.email;
    const isSuperAdmin = userEmail === 'shivamthakur12012@gmail.com' || (req.user as any)?.role === 'Super Admin';
    const { id } = req.params;
    const { status, priority, assignedTo } = req.body;

    const query: any = { _id: id, isDeleted: false };
    if (!isSuperAdmin) {
      query.organizationId = orgId;
    }

    const ticket = await Ticket.findOne(query);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    // Enforce Client Isolation
    if (!isSuperAdmin && orgId) {
      const clientCustomerId = await getClientCustomerId(orgId as string, userEmail);
      if (clientCustomerId && String((ticket.customerId as any)?._id || (ticket.customerId as any)?.id || ticket.customerId) !== clientCustomerId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to this ticket.',
          errorCode: 'FORBIDDEN'
        });
      }
    }

    const targetId = String(ticket.id || ticket._id);
    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    await prisma.ticket.update({
      where: { id: targetId },
      data: updateData
    });

    const updatedTicket = await Ticket.findOne({ _id: targetId })
      .populate('customerId', 'name companyName email phone')
      .populate('assignedTo', 'firstName lastName')
      .populate('organizationId', 'name logoUrl');

    return res.json({
      success: true,
      data: updatedTicket || ticket
    });
  } catch (error) {
    next(error);
  }
}

// Post message reply inside Ticket board thread
export async function postTicketMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const isSuperAdmin = userEmail === 'shivamthakur12012@gmail.com' || (req.user as any)?.role === 'Super Admin';

    let userName = isSuperAdmin ? 'Platform Super Admin' : 'Support Rep';
    if (userId) {
      const userDoc = await User.findById(userId);
      if (userDoc) {
        userName = `${userDoc.firstName} ${userDoc.lastName}`.trim() || userName;
      }
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const query: any = { _id: id, isDeleted: false };
    if (!isSuperAdmin) {
      query.organizationId = orgId;
    }

    const ticket = await Ticket.findOne(query);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    // Enforce Client Isolation
    let clientCustomerId: string | null = null;
    if (!isSuperAdmin && orgId) {
      clientCustomerId = await getClientCustomerId(orgId as string, userEmail);
      if (clientCustomerId && String((ticket.customerId as any)?._id || (ticket.customerId as any)?.id || ticket.customerId) !== clientCustomerId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to this ticket.',
          errorCode: 'FORBIDDEN'
        });
      }
    }

    const senderType = clientCustomerId ? ('customer' as const) : ('user' as const);
    const targetId = String(ticket.id || ticket._id);

    // Save message via Prisma directly
    await prisma.ticketMessage.create({
      data: {
        ticketId: targetId,
        senderId: String(userId || (isSuperAdmin ? 'superadmin' : 'support')),
        senderName: userName,
        senderType,
        content: content.trim(),
        date: new Date()
      }
    });

    // Auto update status: if client replies, set back to "open"; if rep replies, set to "in_progress" (unless already resolved or closed)
    const nextStatus = senderType === 'customer'
      ? 'open'
      : (ticket.status === 'open' ? 'in_progress' : ticket.status);

    await prisma.ticket.update({
      where: { id: targetId },
      data: {
        status: nextStatus,
        updatedAt: new Date()
      }
    });

    // Re-fetch populated ticket
    const updatedTicket = await Ticket.findOne({ _id: targetId })
      .populate('customerId', 'name companyName email phone')
      .populate('assignedTo', 'firstName lastName')
      .populate('organizationId', 'name logoUrl');

    return res.json({
      success: true,
      data: updatedTicket || ticket
    });
  } catch (error) {
    next(error);
  }
}

