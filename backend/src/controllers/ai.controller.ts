import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead';
import { Customer } from '../models/Customer';
import { Deal } from '../models/Deal';
import { Invoice } from '../models/Invoice';
import { Ticket } from '../models/Ticket';
import logger from '../utils/logger';

export async function askAICopilot(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required.',
        errorCode: 'BAD_REQUEST'
      });
    }

    // 1. Gather live RAG context
    const leads = await Lead.find({ organizationId: orgId, isDeleted: false });
    const newLeads = leads.filter(l => l.status === 'New');
    const workingLeads = leads.filter(l => l.status === 'Open');

    const activeCustomers = await Customer.find({ organizationId: orgId, isDeleted: false });

    // Invoices and receivables metrics
    const invoices = await Invoice.find({ organizationId: orgId, isDeleted: false, status: { $ne: 'void' } });
    let totalInvoiced = 0;
    let totalCollected = 0;
    let agingBracket1 = 0; // 1-30 days overdue
    let agingBracket2 = 0; // 31-60 days
    let agingBracket3 = 0; // 61-90 days
    let agingBracket4 = 0; // 91+ days
    const now = new Date();

    for (const inv of invoices) {
      totalInvoiced += inv.totalAmount;
      const paid = (inv.payments || []).reduce((sum, p) => sum + p.amount, 0);
      totalCollected += paid;

      const balance = inv.totalAmount - paid;
      if (balance > 0 && inv.status !== 'draft') {
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24));
        if (daysOverdue > 0) {
          if (daysOverdue <= 30) agingBracket1 += balance;
          else if (daysOverdue <= 60) agingBracket2 += balance;
          else if (daysOverdue <= 90) agingBracket3 += balance;
          else agingBracket4 += balance;
        }
      }
    }
    const totalOutstanding = totalInvoiced - totalCollected;

    // Deals and forecasts expected values
    const deals = await Deal.find({ organizationId: orgId, isDeleted: false }).populate('pipelineId');
    let totalPipelineAmount = 0;
    let totalExpectedValue = 0;

    for (const deal of deals) {
      totalPipelineAmount += deal.amount;
      const pipeline = deal.pipelineId as any;
      if (pipeline) {
        const stage = pipeline.stages.find((s: any) => s._id.toString() === deal.stageId.toString());
        const prob = stage ? stage.winProbability : 50;
        totalExpectedValue += (deal.amount * prob) / 100;
      }
    }

    // Support tickets
    const tickets = await Ticket.find({ organizationId: orgId, isDeleted: false });
    const openTickets = tickets.filter(t => t.status === 'open');
    const progressTickets = tickets.filter(t => t.status === 'in_progress');
    const resolvedTickets = tickets.filter(t => t.status === 'resolved');

    logger.info(`AI Copilot aggregated CRM context for organization "${orgId}"`);

    // 2. Hybrid completions: Smart Local NLP Fallback
    const q = message.toLowerCase();
    let reply = '';

    if (q.includes('forecast') || q.includes('pipeline') || q.includes('deal') || q.includes('expect')) {
      reply = `Based on your live sales pipeline, you currently have **${deals.length} active opportunities**.\n\n` +
              `- **Total Pipeline Value**: ₹${totalPipelineAmount.toLocaleString()}\n` +
              `- **Weighted Expected Forecast**: ₹${totalExpectedValue.toLocaleString()}\n\n` +
              `Opportunities are spread across stages with auto-calculated win probabilities. Would you like me to highlight high-value deals?`;
    } 
    else if (q.includes('overdue') || q.includes('invoice') || q.includes('aging') || q.includes('receivable') || q.includes('collect')) {
      reply = `Here is your accounts outstanding balance report:\n\n` +
              `- **Total Sales Billed**: ₹${totalInvoiced.toLocaleString()}\n` +
              `- **Collected Revenue**: ₹${totalCollected.toLocaleString()}\n` +
              `- **Outstanding Balance**: ₹${totalOutstanding.toLocaleString()}\n\n` +
              `**Invoice Aging Intervals Overdue:**\n` +
              `- **1 - 30 Days**: ₹${agingBracket1.toLocaleString()}\n` +
              `- **31 - 60 Days**: ₹${agingBracket2.toLocaleString()}\n` +
              `- **61 - 90 Days**: ₹${agingBracket3.toLocaleString()}\n` +
              `- **91+ Days Overdue**: ₹${agingBracket4.toLocaleString()}\n\n` +
              `You can review individual invoices or record UPI/bank transfer payments on the Invoicing Ledger dashboard.`;
    } 
    else if (q.includes('ticket') || q.includes('support') || q.includes('help') || q.includes('query')) {
      reply = `You have **${tickets.length} support tickets** logged in your tenant.\n\n` +
              `- **Open tickets**: ${openTickets.length} (needs replies)\n` +
              `- **In Progress**: ${progressTickets.length} (assigned to reps)\n` +
              `- **Resolved**: ${resolvedTickets.length} (closed or finalized)\n\n` +
              `Let me know if you would like me to summarize any ticket thread details.`;
    } 
    else if (q.includes('lead') || q.includes('crm') || q.includes('contact')) {
      reply = `Your CRM contains **${leads.length} active leads** and **${activeCustomers.length} converted customer accounts**.\n\n` +
              `- **New Leads**: ${newLeads.length} (requires follow-up)\n` +
              `- **Working Leads**: ${workingLeads.length} (contacted/negotiating)\n\n` +
              `Would you like to assign pending leads or configure welcome task automation rules?`;
    } 
    else {
      // General Workspace summary
      reply = `Hello! I am your ArthaVenture Copilot AI Assistant. I have gathered your workspace context and analyzed your tenant records:\n\n` +
              `- **CRM Status**: ${leads.length} active leads | ${activeCustomers.length} converted customers\n` +
              `- **Sales Forecast**: ₹${totalExpectedValue.toLocaleString()} expected value from ${deals.length} deals\n` +
              `- **Financial Status**: ₹${totalOutstanding.toLocaleString()} outstanding receivables across ${invoices.length} invoices\n` +
              `- **Helpdesk Tickets**: ${tickets.length} support tickets (${openTickets.length} open)\n\n` +
              `You can ask me questions like *"Show overdue invoices"*, *"What is my expected forecast?"*, or *"Summarize support tickets"*. How can I help you today?`;
    }

    return res.json({
      success: true,
      data: {
        reply,
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
}
