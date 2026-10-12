import { Request, Response, NextFunction } from 'express';
import { Invoice, mongoose } from '../models';
import { Customer } from '../models/Customer';
import { Activity } from '../models/Activity';
import { Subscription } from '../models/Subscription';

// List Invoices with filters
export async function getInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { status, customerId } = req.query;

    const query: any = { organizationId: orgId, isDeleted: false };
    if (status) query.status = status;
    if (customerId) query.customerId = customerId;

    const invoices = await Invoice.find(query)
      .populate('customerId', 'name companyName email phone')
      .populate('items')
      .populate('payments')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    next(error);
  }
}

// Single Invoice Profile
export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const invoice = await Invoice.findOne({ _id: id, organizationId: orgId, isDeleted: false })
      .populate('customerId', 'name companyName email phone billingAddress gstin pan')
      .populate('items')
      .populate('payments');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found.',
        errorCode: 'INVOICE_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
}

// Create Invoice (Draft / Sent)
export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { customerId, date, dueDate, items, notes, status = 'draft' } = req.body;

    // Subscription Limits Quota Verification Check
    const sub = await Subscription.findOne({ organizationId: orgId }).session(session);
    if (sub) {
      if (sub.currentBillingCycleInvoices >= sub.invoicesCountLimit) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          success: false,
          message: `Your subscription monthly invoice limit (${sub.invoicesCountLimit}) has been exceeded. Please upgrade your plan.`,
          errorCode: 'SUBSCRIPTION_LIMIT_EXCEEDED'
        });
      }
      sub.currentBillingCycleInvoices += 1;
      await sub.save({ session });
    }

    // 1. Calculate values
    let subtotal = 0;
    let taxTotal = 0;

    const lineItems = items.map((item: any) => {
      const lineSub = Number(item.quantity) * Number(item.rate);
      const lineTax = lineSub * (Number(item.gstRate || 18) / 100);
      const lineTot = lineSub + lineTax;

      subtotal += lineSub;
      taxTotal += lineTax;

      return {
        itemId: item.itemId,
        name: item.name,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        gstRate: Number(item.gstRate || 18),
        taxAmount: lineTax,
        subtotal: lineSub,
        total: lineTot
      };
    });

    const totalAmount = subtotal + taxTotal;

    // 2. Create Invoice Document
    const invoice = await Invoice.create({
      organizationId: orgId,
      customerId,
      date: date ? new Date(date) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: lineItems,
      subtotal,
      taxTotal,
      totalAmount,
      status,
      payments: [],
      notes
    });

    // 3. Update customer outstanding balance if created directly as "sent"
    if (status === 'sent') {
      await Customer.findByIdAndUpdate(
        customerId,
        { $inc: { outstandingBalance: totalAmount } },
        { session }
      );
    }

    // 4. Logs
    await Activity.create([{
      organizationId: orgId,
      customerId,
      userId,
      type: 'note',
      content: `Invoice "${invoice.invoiceId}" created in status "${status.toUpperCase()}" for total ₹${totalAmount.toLocaleString()}.`
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
}

// Transition Invoice status (Draft -> Sent, Sent -> Void)
export async function transitionInvoiceStatus(req: Request, res: Response, next: NextFunction) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { status } = req.body; // e.g. "sent", "void"

    const invoice = await Invoice.findOne({ _id: id, organizationId: orgId, isDeleted: false }).session(session);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    const oldStatus = invoice.status;
    if (oldStatus === status) {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already in this status.',
        errorCode: 'BAD_REQUEST'
      });
    }

    // Apply ledger synchronization logic
    if (oldStatus === 'draft' && status === 'sent') {
      // Draft to Sent -> Increment balance by full amount
      await Customer.findByIdAndUpdate(
        invoice.customerId,
        { $inc: { outstandingBalance: invoice.totalAmount } },
        { session }
      );
    } else if (oldStatus === 'sent' && status === 'void') {
      // Sent to Void -> Decrement outstanding balance by remaining unpaid amount
      const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
      const remainingUnpaid = invoice.totalAmount - totalPaid;
      await Customer.findByIdAndUpdate(
        invoice.customerId,
        { $inc: { outstandingBalance: -remainingUnpaid } },
        { session }
      );
    } else if ((oldStatus === 'paid' || oldStatus === 'partial') && status === 'void') {
      // Paid/Partial to Void -> Decrement outstanding by remaining unpaid (which might be 0)
      const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
      const remainingUnpaid = invoice.totalAmount - totalPaid;
      if (remainingUnpaid > 0) {
        await Customer.findByIdAndUpdate(
          invoice.customerId,
          { $inc: { outstandingBalance: -remainingUnpaid } },
          { session }
        );
      }
    }

    invoice.status = status;
    await invoice.save({ session });

    // Activity timeline
    await Activity.create([{
      organizationId: orgId,
      customerId: invoice.customerId,
      userId,
      type: 'status_change',
      content: `Invoice ${invoice.invoiceId} status changed from "${oldStatus}" to "${status}".`
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: `Invoice status updated to ${status}.`,
      data: invoice
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
}

// Record Invoice Payment
export async function recordPayment(req: Request, res: Response, next: NextFunction) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { amount, reference, date, method } = req.body;

    const invoice = await Invoice.findOne({ _id: id, organizationId: orgId, isDeleted: false }).session(session);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    if (invoice.status === 'draft' || invoice.status === 'void') {
      return res.status(400).json({
        success: false,
        message: 'Payments cannot be recorded against draft or voided invoices.',
        errorCode: 'BAD_REQUEST'
      });
    }

    const currentPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const newPaidTotal = currentPaid + Number(amount);

    if (newPaidTotal > invoice.totalAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment exceeds invoice total amount. Maximum recordable is ₹${(invoice.totalAmount - currentPaid).toLocaleString()}`,
        errorCode: 'OVERPAYMENT'
      });
    }

    // 1. Append payment record
    invoice.payments = [
      ...(invoice.payments || []),
      {
        amount: Number(amount),
        reference,
        date: date ? new Date(date) : new Date(),
        method
      }
    ];

    // 2. Resolve status and update balances
    invoice.amountPaid = newPaidTotal;
    invoice.outstandingBalance = Math.max(0, Math.round((invoice.totalAmount - newPaidTotal) * 100) / 100);

    if (newPaidTotal >= invoice.totalAmount) {
      invoice.status = 'paid';
    } else {
      invoice.status = 'partial';
    }

    await invoice.save({ session });

    // 3. Decrement customer outstanding balance by paid amount
    await Customer.findByIdAndUpdate(
      invoice.customerId,
      { $inc: { outstandingBalance: -Number(amount) } },
      { session }
    );

    // 4. Log Activity
    await Activity.create([{
      organizationId: orgId,
      customerId: invoice.customerId,
      userId,
      type: 'note',
      content: `Recorded payment of ₹${Number(amount).toLocaleString()} (${method.toUpperCase()}) against Invoice "${invoice.invoiceId}".`
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: 'Payment recorded and ledger updated.',
      data: invoice
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
}
