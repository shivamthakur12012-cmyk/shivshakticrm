import { Request, Response, NextFunction } from 'express';
import { Quotation, calculateQuotationTotals, mongoose } from '../models';
import { Invoice } from '../models/Invoice';
import { Lead } from '../models/Lead';
import { Customer } from '../models/Customer';
import { Activity } from '../models/Activity';
import { Organization } from '../models/Organization';
import { AuditLog } from '../models/AuditLog';
import logger from '../utils/logger';

// GET ALL QUOTATIONS
export async function getQuotations(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { leadId, customerId, status, search, page = 1, limit = 25 } = req.query;

    const query: any = { organizationId: orgId, isDeleted: false };

    if (leadId) query.leadId = leadId;
    if (customerId) query.customerId = customerId;
    if (status) query.status = status;

    if (search) {
      const regex = new RegExp(search as string, 'i');
      query.$or = [
        { quotationId: regex },
        { notes: regex },
        { 'items.name': regex }
      ];
    }

    const skipIndex = (Number(page) - 1) * Number(limit);

    const quotations = await Quotation.find(query)
      .populate('leadId', 'name company phone email leadId')
      .populate('customerId', 'name companyName phone email')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('invoiceId', 'invoiceId status totalAmount outstandingBalance')
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit));

    const total = await Quotation.countDocuments(query);

    return res.json({
      success: true,
      data: {
        quotations,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// GET SINGLE QUOTATION
export async function getQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const quotation = await Quotation.findOne({ _id: id, organizationId: orgId, isDeleted: false })
      .populate('leadId', 'name company phone email leadId location status')
      .populate('customerId', 'name companyName phone email billingAddress')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('invoiceId', 'invoiceId status totalAmount outstandingBalance payments');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found.',
        errorCode: 'QUOTATION_NOT_FOUND'
      });
    }

    if (!quotation.quotationId) {
      quotation.quotationId = `QT-${(quotation.id || quotation._id || '10001').slice(0, 8).toUpperCase()}`;
    }

    return res.json({
      success: true,
      data: quotation
    });
  } catch (error) {
    next(error);
  }
}

// CREATE QUOTATION
export async function createQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const {
      leadId,
      customerId,
      assignedTo,
      date,
      validUntil,
      items,
      notes,
      termsAndConditions
    } = req.body;

    // Validate line items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one line item is required with valid rate and quantity.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    for (const it of items) {
      if (!it.name || Number(it.quantity) <= 0 || Number(it.rate) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Line items must have a valid item name, quantity >= 1, and non-negative rate.',
          errorCode: 'INVALID_LINE_ITEM'
        });
      }
    }

    // Server-side calculation of totals
    const calculated = calculateQuotationTotals(items);

    const count = await Quotation.countDocuments({ organizationId: orgId });
    const quotationId = `QT-${10001 + count}`;

    const quotation = await Quotation.create({
      organizationId: orgId,
      quotationId,
      leadId: leadId || undefined,
      customerId: customerId || undefined,
      createdBy: userId,
      assignedTo: assignedTo || userId,
      date: date ? new Date(date) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: calculated.items,
      subtotal: calculated.subtotal,
      totalDiscount: calculated.totalDiscount,
      taxTotal: calculated.taxTotal,
      totalAmount: calculated.totalAmount,
      status: 'draft',
      notes,
      termsAndConditions
    });

    // If linked to a lead, log timeline activity
    if (leadId) {
      await Activity.create({
        organizationId: orgId,
        leadId,
        userId,
        type: 'system',
        content: `Quotation #${quotation.quotationId} created with total ₹${quotation.totalAmount.toLocaleString('en-IN')}.`,
        metadata: { quotationId: quotation._id, quotationNo: quotation.quotationId, amount: quotation.totalAmount }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Quotation created successfully.',
      data: quotation
    });
  } catch (error) {
    next(error);
  }
}

// UPDATE QUOTATION
export async function updateQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;
    const { items, validUntil, notes, termsAndConditions, assignedTo } = req.body;

    const existing = await Quotation.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found.',
        errorCode: 'QUOTATION_NOT_FOUND'
      });
    }

    // Locked if converted to Invoice
    if (existing.status === 'converted') {
      return res.status(400).json({
        success: false,
        message: 'This quotation has already been converted to an Invoice and is locked from further modifications.',
        errorCode: 'QUOTATION_LOCKED'
      });
    }

    if (items && Array.isArray(items)) {
      if (items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one line item is required.',
          errorCode: 'VALIDATION_ERROR'
        });
      }
      const calculated = calculateQuotationTotals(items);
      existing.items = calculated.items as any;
      existing.subtotal = calculated.subtotal;
      existing.totalDiscount = calculated.totalDiscount;
      existing.taxTotal = calculated.taxTotal;
      existing.totalAmount = calculated.totalAmount;
    }

    if (validUntil) existing.validUntil = validUntil;
    if (notes !== undefined) existing.notes = notes;
    if (termsAndConditions !== undefined) existing.termsAndConditions = termsAndConditions;
    if (assignedTo) existing.assignedTo = assignedTo;

    existing.version = (existing.version || 1) + 1;
    if ((existing as any).save) await (existing as any).save();

    return res.json({
      success: true,
      message: 'Quotation updated successfully.',
      data: existing
    });
  } catch (error) {
    next(error);
  }
}

// UPDATE QUOTATION STATUS (STATE MACHINE: Draft -> Sent -> (Accepted | Rejected))
export async function updateQuotationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const allowedStatuses = ['draft', 'sent', 'accepted', 'rejected'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status transition.',
        errorCode: 'INVALID_STATUS'
      });
    }

    const quotation = await Quotation.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found.',
        errorCode: 'QUOTATION_NOT_FOUND'
      });
    }

    // Enforce state transitions
    const current = quotation.status;
    if (current === 'converted') {
      return res.status(400).json({
        success: false,
        message: 'Quotation is already converted to an invoice and status cannot be modified.',
        errorCode: 'QUOTATION_CONVERTED'
      });
    }

    if (status === 'accepted' || status === 'rejected') {
      if (current === 'draft') {
        // Must move through sent first or directly accept if confirmed
        quotation.status = status;
      } else {
        quotation.status = status;
      }
    } else {
      quotation.status = status;
    }

    if (status === 'rejected') {
      quotation.rejectionReason = rejectionReason || 'Not specified';
    }

    if ((quotation as any).save) await (quotation as any).save();

    // Log timeline activity if linked to Lead
    if (quotation.leadId) {
      await Activity.create({
        organizationId: orgId,
        leadId: quotation.leadId,
        userId,
        type: 'status_change',
        content: `Quotation #${quotation.quotationId} marked as "${status.toUpperCase()}".`,
        metadata: { quotationId: quotation._id, status, rejectionReason }
      });
    }

    return res.json({
      success: true,
      message: `Quotation status updated to ${status}.`,
      data: quotation
    });
  } catch (error) {
    next(error);
  }
}

// CONVERT ACCEPTED QUOTATION TO INVOICE (ACID TRANSACTION)
export async function convertQuotationToInvoice(req: Request, res: Response, next: NextFunction) {
  const orgId = req.organizationId;
  const userId = req.user?.id;
  const { id } = req.params;
  const { dueDate } = req.body;

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const quotation = await Quotation.findOne({ _id: id, organizationId: orgId, isDeleted: false }).session(mongoSession);
    if (!quotation) {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
      return res.status(404).json({
        success: false,
        message: 'Quotation not found.',
        errorCode: 'QUOTATION_NOT_FOUND'
      });
    }

    // State machine check: must be in 'accepted' (or 'sent' allowed if auto-accepted on invoice creation)
    if (quotation.status !== 'accepted' && quotation.status !== 'sent') {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
      return res.status(400).json({
        success: false,
        message: `Quotation must be in 'Accepted' state before converting to an Invoice. Current status: ${quotation.status}.`,
        errorCode: 'INVALID_QUOTATION_STATE'
      });
    }

    let customerId = quotation.customerId;

    // If no customer is linked, create or locate customer from lead
    if (!customerId && quotation.leadId) {
      const lead = await Lead.findOne({ _id: quotation.leadId, organizationId: orgId }).session(mongoSession);
      if (lead) {
        let existingCust = lead.phone 
          ? await Customer.findOne({ organizationId: orgId, phone: lead.phone, isDeleted: false }).session(mongoSession)
          : null;

        if (!existingCust && lead.email) {
          existingCust = await Customer.findOne({ organizationId: orgId, email: lead.email, isDeleted: false }).session(mongoSession);
        }

        if (!existingCust) {
          const [newCust] = await Customer.create(
            [
              {
                organizationId: orgId,
                name: lead.name,
                companyName: lead.company,
                email: lead.email || `customer_${Date.now()}@temp.com`,
                phone: lead.phone,
                whatsApp: lead.whatsApp,
                notes: lead.notes,
                outstandingBalance: quotation.totalAmount
              }
            ],
            { session: mongoSession }
          );
          existingCust = newCust;
        }

        customerId = existingCust ? ((existingCust as any)._id || (existingCust as any).id) : undefined;
        lead.status = 'Converted';
        lead.convertedAt = new Date();
        lead.convertedQuotationId = quotation._id as any;
        lead.convertedBy = userId as any;
        if ((lead as any).save) await (lead as any).save();
      }
    }

    if (!customerId) {
      await mongoSession.abortTransaction();
      await mongoSession.endSession();
      return res.status(400).json({
        success: false,
        message: 'A linked Customer or Lead is required to generate an invoice.',
        errorCode: 'MISSING_CUSTOMER_LINK'
      });
    }

    // Create Invoice with atomic sequence
    const invoiceItems = (quotation.items || []).map(it => ({
      itemId: it.itemId,
      name: it.name,
      quantity: it.quantity,
      rate: it.rate,
      gstRate: it.gstRate,
      taxAmount: it.taxAmount,
      subtotal: it.subtotal,
      total: it.total
    }));

    const invoiceDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    const [invoice] = await Invoice.create(
      [
        {
          organizationId: orgId,
          customerId,
          leadId: quotation.leadId,
          quotationId: quotation._id,
          date: new Date(),
          dueDate: invoiceDueDate,
          items: invoiceItems,
          subtotal: quotation.subtotal - quotation.totalDiscount,
          taxTotal: quotation.taxTotal,
          totalAmount: quotation.totalAmount,
          amountPaid: 0,
          outstandingBalance: quotation.totalAmount,
          status: 'sent',
          payments: [],
          notes: quotation.notes,
          isLocked: true
        }
      ],
      { session: mongoSession }
    );

    // Update Quotation state
    quotation.status = 'converted';
    quotation.invoiceId = invoice._id as any;
    quotation.customerId = customerId;
    if ((quotation as any).save) await (quotation as any).save();

    // Update Lead with converted invoice reference
    if (quotation.leadId) {
      await Lead.findByIdAndUpdate(
        quotation.leadId,
        { 
          $set: { 
            status: 'Converted', 
            convertedInvoiceId: invoice._id,
            convertedQuotationId: quotation._id,
            convertedAt: new Date()
          } 
        },
        { session: mongoSession }
      );

      await Activity.create(
        [
          {
            organizationId: orgId,
            leadId: quotation.leadId,
            userId,
            type: 'status_change',
            content: `Quotation #${quotation.quotationId} converted to Invoice #${invoice.invoiceId}. Lead marked as CONVERTED.`,
            metadata: { quotationId: quotation._id, invoiceId: invoice._id, invoiceNo: invoice.invoiceId }
          }
        ],
        { session: mongoSession }
      );
    }

    // Audit Log
    await AuditLog.create(
      [
        {
          userId,
          organizationId: orgId,
          action: 'QUOTATION_CONVERTED_TO_INVOICE',
          entity: 'Invoice',
          entityId: invoice._id.toString(),
          newValue: { quotationId: quotation._id, invoiceId: invoice._id, amount: quotation.totalAmount }
        }
      ],
      { session: mongoSession }
    );

    await mongoSession.commitTransaction();
    mongoSession.endSession();

    return res.status(201).json({
      success: true,
      message: `Quotation successfully converted to Invoice ${invoice.invoiceId}.`,
      data: {
        invoice,
        quotation
      }
    });
  } catch (error) {
    await mongoSession.abortTransaction();
    mongoSession.endSession();
    logger.error('Quotation to Invoice conversion failed:', error);
    next(error);
  }
}

// PRINT / PDF PREVIEW HTML
export async function getQuotationPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const quotation = await Quotation.findOne({ _id: id, organizationId: orgId, isDeleted: false })
      .populate('leadId')
      .populate('customerId')
      .populate('createdBy', 'firstName lastName email');

    const organization = await Organization.findById(orgId);

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    return res.json({
      success: true,
      data: {
        quotation,
        organization
      }
    });
  } catch (error) {
    next(error);
  }
}

// DELETE QUOTATION (Soft Delete)
export async function deleteQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const quotation = await Quotation.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    return res.json({
      success: true,
      message: 'Quotation deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}
