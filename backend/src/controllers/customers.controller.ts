import { Request, Response, NextFunction } from 'express';
import { Customer } from '../models/Customer';
import { Contact } from '../models/Contact';
import { Activity } from '../models/Activity';
import { AuditLog } from '../models/AuditLog';

export async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { search, page = 1, limit = 20 } = req.query;

    const query: any = { organizationId: orgId, isDeleted: false };

    if (search) {
      const regex = new RegExp(search as string, 'i');
      query.$or = [
        { name: regex },
        { companyName: regex },
        { email: regex },
        { phone: regex },
        { customerId: regex }
      ];
    }

    const skipIndex = (Number(page) - 1) * Number(limit);

    const customers = await Customer.find(query)
      .sort({ name: 1 })
      .skip(skipIndex)
      .limit(Number(limit));

    const total = await Customer.countDocuments(query);

    return res.json({
      success: true,
      data: {
        customers,
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

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const customer = await Customer.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.',
        errorCode: 'CUSTOMER_NOT_FOUND'
      });
    }

    const contacts = await Contact.find({ customerId: customer._id, organizationId: orgId, isDeleted: false });

    // Fetch activities / timeline logs
    const activities = await Activity.find({ customerId: customer._id, organizationId: orgId })
      .populate('userId', 'firstName lastName')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        customer,
        contacts,
        activities
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { name, companyName, email, phone, whatsApp, alternatePhone, gstin, pan, billingAddress, notes } = req.body;

    // Check duplicate email or phone
    const existing = await Customer.findOne({
      organizationId: orgId,
      isDeleted: false,
      $or: [{ email }, { phone }]
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email or phone number already exists.',
        errorCode: 'DUPLICATE_CUSTOMER'
      });
    }

    const customer = await Customer.create({
      organizationId: orgId,
      name,
      companyName,
      email,
      phone,
      whatsApp,
      alternatePhone,
      gstin,
      pan,
      billingAddress,
      notes,
      outstandingBalance: 0
    });

    // Create a primary Contact entry
    await Contact.create({
      organizationId: orgId,
      customerId: customer._id,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' ') || undefined,
      email,
      phone,
      whatsApp,
      isPrimary: true
    });

    // Audit log
    await AuditLog.create({
      userId,
      organizationId: orgId,
      action: 'CUSTOMER_CREATED',
      entity: 'Customer',
      entityId: customer._id.toString(),
      newValue: { name, email }
    });

    return res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const oldCustomer = await Customer.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!oldCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.',
        errorCode: 'CUSTOMER_NOT_FOUND'
      });
    }

    const updates = req.body;
    const updatedCustomer = await Customer.findByIdAndUpdate(id, { $set: updates }, { new: true });

    // Audit log
    await AuditLog.create({
      userId,
      organizationId: orgId,
      action: 'CUSTOMER_UPDATED',
      entity: 'Customer',
      entityId: id,
      oldValue: oldCustomer.toObject(),
      newValue: updatedCustomer?.toObject()
    });

    return res.json({
      success: true,
      data: updatedCustomer
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const customer = await Customer.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.',
        errorCode: 'CUSTOMER_NOT_FOUND'
      });
    }

    // Soft delete associated contacts
    await Contact.updateMany({ customerId: id, organizationId: orgId }, { $set: { isDeleted: true } });

    // Audit log
    await AuditLog.create({
      userId,
      organizationId: orgId,
      action: 'CUSTOMER_DELETED',
      entity: 'Customer',
      entityId: id
    });

    return res.json({
      success: true,
      message: 'Customer and contacts deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}
