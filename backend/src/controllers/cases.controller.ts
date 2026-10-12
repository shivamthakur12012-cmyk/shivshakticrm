import { Request, Response, NextFunction } from 'express';
import { ServiceCase, ICaseChecklistItem } from '../models/ServiceCase';
import { Activity } from '../models/Activity';

// Helper: Get checklist items template by service category
function getChecklistTemplate(serviceId: string): { name: string; isRequired: boolean }[] {
  switch (serviceId) {
    case 'business_loan':
      return [
        { name: 'PAN Card (Promoters & Business)', isRequired: true },
        { name: 'Aadhaar Card (Promoters)', isRequired: true },
        { name: '6 Months Bank Statements', isRequired: true },
        { name: '2 Years ITR Filing Documents', isRequired: true },
        { name: 'GST Returns (1 Year)', isRequired: false },
        { name: 'Business Address Proof (Rent Agreement/Utility Bill)', isRequired: true }
      ];
    case 'gst_registration':
      return [
        { name: 'PAN Card of Applicant', isRequired: true },
        { name: 'Aadhaar Card of Applicant', isRequired: true },
        { name: 'Business Address Proof (Electricity Bill / NOC)', isRequired: true },
        { name: 'Rent Agreement (if applicable)', isRequired: false },
        { name: 'Passport Size Photograph', isRequired: true }
      ];
    case 'company_registration':
      return [
        { name: 'Director PAN Cards', isRequired: true },
        { name: 'Director Aadhaar/Identity Proofs', isRequired: true },
        { name: 'Director Address Proofs (Bank Statement / Mobile Bill)', isRequired: true },
        { name: 'Registered Office Utility Bill', isRequired: true },
        { name: 'NOC from Property Owner', isRequired: true }
      ];
    case 'trademark':
      return [
        { name: 'Brand Logo image (JPEG/PNG)', isRequired: true },
        { name: 'Signed TM-48 Authorisation Letter', isRequired: true },
        { name: 'Certificate of Incorporation (if Corporate)', isRequired: false }
      ];
    case 'msme_udyam':
      return [
        { name: 'Aadhaar Card of Proprietor/Director', isRequired: true },
        { name: 'PAN Card of Entity', isRequired: true },
        { name: 'Bank Account Passbook/Cheque leaf', isRequired: true }
      ];
    case 'business_certification':
      return [
        { name: 'PAN & Aadhaar', isRequired: true },
        { name: 'Incorporation Certificate', isRequired: true },
        { name: 'Product/Service details list', isRequired: true },
        { name: 'ISO Quality Manual files', isRequired: false }
      ];
    default:
      return [
        { name: 'Identity Proof (PAN / Aadhaar)', isRequired: true },
        { name: 'Address Proof Documents', isRequired: true }
      ];
  }
}

export async function getCases(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { serviceId, stage, customerId } = req.query;

    const query: any = { organizationId: orgId };
    if (serviceId) query.serviceId = serviceId;
    if (stage) query.stage = stage;
    if (customerId) query.customerId = customerId;

    const cases = await ServiceCase.find(query)
      .populate('customerId', 'name companyName email phone')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: cases
    });
  } catch (error) {
    next(error);
  }
}

export async function getCase(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const serviceCase = await ServiceCase.findOne({ _id: id, organizationId: orgId })
      .populate('customerId', 'name companyName email phone billingAddress')
      .populate('dealId', 'title amount')
      .populate('assignedTo', 'firstName lastName')
      .populate('checklist.documentId', 'fileName fileType fileSize storageKey provider');

    if (!serviceCase) {
      return res.status(404).json({
        success: false,
        message: 'Service case not found.',
        errorCode: 'CASE_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: serviceCase
    });
  } catch (error) {
    next(error);
  }
}

export async function createCase(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { customerId, dealId, leadId, serviceId, serviceName, assignedTo } = req.body;

    // Build checklist template
    const template = getChecklistTemplate(serviceId);
    const checklist: ICaseChecklistItem[] = template.map(t => ({
      name: t.name,
      isRequired: t.isRequired,
      status: 'pending'
    }));

    const serviceCase = await ServiceCase.create({
      organizationId: orgId,
      customerId,
      dealId,
      leadId,
      serviceId,
      serviceName,
      assignedTo: assignedTo || userId,
      stage: 'created',
      checklist
    });

    // Logging Activity
    await Activity.create({
      organizationId: orgId,
      customerId,
      dealId,
      userId,
      type: 'status_change',
      content: `Consulting Case "${serviceName}" created (Case ID: ${serviceCase.caseId}) with ${checklist.length} document requirements.`
    });

    return res.status(201).json({
      success: true,
      data: serviceCase
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCaseStage(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { stage } = req.body;

    const oldCase = await ServiceCase.findOne({ _id: id, organizationId: orgId });
    if (!oldCase) {
      return res.status(404).json({
        success: false,
        message: 'Service case not found.',
        errorCode: 'CASE_NOT_FOUND'
      });
    }

    const updatedCase = await ServiceCase.findByIdAndUpdate(
      id,
      { $set: { stage } },
      { new: true }
    );

    // Logging Activity
    await Activity.create({
      organizationId: orgId,
      customerId: oldCase.customerId,
      dealId: oldCase.dealId,
      userId,
      type: 'status_change',
      content: `Case stage updated from "${oldCase.stage.toUpperCase()}" to "${stage.toUpperCase()}".`
    });

    return res.json({
      success: true,
      data: updatedCase
    });
  } catch (error) {
    next(error);
  }
}

// Update Checklist Item status (e.g. approve/reject document)
export async function updateCaseChecklistItem(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id, itemId } = req.params;
    const { status, reviewerNotes } = req.body;

    const serviceCase = await ServiceCase.findOne({ _id: id, organizationId: orgId });
    if (!serviceCase) {
      return res.status(404).json({
        success: false,
        message: 'Service case not found.',
        errorCode: 'CASE_NOT_FOUND'
      });
    }

    const item = (serviceCase.checklist || []).find((c: any) => (c._id || c.id)?.toString() === itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Checklist item not found.',
        errorCode: 'ITEM_NOT_FOUND'
      });
    }

    // Apply updates
    if (status) item.status = status;
    if (reviewerNotes !== undefined) item.reviewerNotes = reviewerNotes;

    await serviceCase.save();

    // Log Activity
    await Activity.create({
      organizationId: orgId,
      customerId: serviceCase.customerId,
      dealId: serviceCase.dealId,
      userId,
      type: 'note',
      content: `Checklist document "${item.name}" updated to state "${status.toUpperCase()}".`
    });

    return res.json({
      success: true,
      data: serviceCase
    });
  } catch (error) {
    next(error);
  }
}
