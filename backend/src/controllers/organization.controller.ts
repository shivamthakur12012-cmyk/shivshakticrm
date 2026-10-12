import { Request, Response, NextFunction } from 'express';
import { Organization } from '../models/Organization';
import { AuditLog } from '../models/AuditLog';
import { Role } from '../models/Role';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { Pipeline } from '../models/Pipeline';
import logger from '../utils/logger';

export async function onboard(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, businessType, address, phone, email, website, gstin, pan, bankName, bankAccount, bankIfsc, bankUpi } = req.body;

    // Check if the user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication context missing.',
        errorCode: 'UNAUTHORIZED'
      });
    }

    // Create a new organization and assign the creator as Org Admin
    const org = await Organization.create({
      name,
      businessType,
      address,
      phone,
      email,
      website,
      gstin,
      pan,
      bankName: bankName || null,
      bankAccount: bankAccount || null,
      bankIfsc: bankIfsc ? bankIfsc.toUpperCase().trim() : null,
      bankUpi: bankUpi || null,
      isSuspended: false
    });

    const orgId = (org as any)._id || (org as any).id;

    // Link user to this new organization - Resolve Admin role with fallbacks
    let orgAdminRole = await Role.findOne({ name: 'Admin', organizationId: null });
    if (!orgAdminRole) {
      orgAdminRole = await Role.findOne({ name: 'Super Admin', organizationId: null });
    }
    if (!orgAdminRole) {
      orgAdminRole = await Role.findOne({ name: 'Organization Admin', organizationId: null });
    }
    if (!orgAdminRole) {
      orgAdminRole = await Role.findOne({ organizationId: null });
    }

    if (!orgAdminRole) {
      return res.status(500).json({
        success: false,
        message: 'System organization admin role not found.',
        errorCode: 'INTERNAL_ERROR'
      });
    }

    const userId = (req.user as any)._id || req.user.id;
    const roleId = (orgAdminRole as any)._id || (orgAdminRole as any).id;

    await UserOrganizationRole.create({
      userId,
      organizationId: orgId,
      roleId
    });

    // Seed default General Sales Pipeline for the new organization
    try {
      const existingPipeline = await Pipeline.findOne({ organizationId: orgId });
      if (!existingPipeline) {
        await Pipeline.create({
          organizationId: orgId,
          name: 'General Sales Pipeline',
          isSystem: true,
          stages: [
            { name: 'New Lead', probability: 10, order: 0 },
            { name: 'Contacted', probability: 30, order: 1 },
            { name: 'Qualified', probability: 50, order: 2 },
            { name: 'Proposal Sent', probability: 75, order: 3 },
            { name: 'Negotiation', probability: 90, order: 4 },
            { name: 'Closed Won', probability: 100, order: 5 },
            { name: 'Closed Lost', probability: 0, order: 6 }
          ]
        });
      }
    } catch (pipelineErr) {
      logger.warn('Error auto-seeding pipeline during onboarding:', pipelineErr);
    }

    // Provision tenant schema if tenant schema service is active
    try {
      const { tenantSchemaService } = await import('../services/tenantSchema.service');
      await tenantSchemaService.createTenantSchema(orgId);
    } catch (schemaErr) {
      logger.warn(`Tenant schema provisioning notice for ${orgId}:`, schemaErr);
    }

    // Audit log
    await AuditLog.create({
      userId,
      organizationId: orgId,
      action: 'ORGANIZATION_ONBOARDED',
      entity: 'Organization',
      entityId: orgId.toString(),
      newValue: { name, businessType }
    });

    const orgData = (org as any).toObject ? (org as any).toObject() : org;
    return res.status(201).json({
      success: true,
      message: 'Organization onboarded successfully.',
      data: {
        ...orgData,
        _id: orgId,
        id: orgId
      }
    });
  } catch (error) {
    logger.error('Organization onboarding error:', error);
    next(error);
  }
}

export async function getOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context missing.',
        errorCode: 'ORGANIZATION_CONTEXT_REQUIRED'
      });
    }

    const org = await Organization.findById(req.organizationId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.',
        errorCode: 'ORGANIZATION_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: org
    });
  } catch (error) {
    logger.error('GetOrganization error:', error);
    next(error);
  }
}

export async function updateOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context missing.',
        errorCode: 'ORGANIZATION_CONTEXT_REQUIRED'
      });
    }

    const { name, phone, email, website, address, gstin, pan, currency, timezone, bankName, bankAccount, bankIfsc, bankUpi } = req.body;

    const oldOrg = await Organization.findById(req.organizationId);
    if (!oldOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.',
        errorCode: 'ORGANIZATION_NOT_FOUND'
      });
    }

    const updatedOrg = await Organization.findByIdAndUpdate(
      req.organizationId,
      {
        $set: {
          name,
          phone,
          email,
          website,
          address,
          gstin,
          pan,
          currency,
          timezone,
          bankName,
          bankAccount,
          bankIfsc: bankIfsc ? bankIfsc.toUpperCase().trim() : undefined,
          bankUpi
        }
      },
      { new: true }
    );

    // Audit log
    await AuditLog.create({
      userId: req.user?.id,
      organizationId: req.organizationId,
      action: 'ORGANIZATION_UPDATED',
      entity: 'Organization',
      entityId: req.organizationId,
      oldValue: (oldOrg as any).toObject ? (oldOrg as any).toObject() : oldOrg,
      newValue: (updatedOrg as any)?.toObject ? (updatedOrg as any).toObject() : updatedOrg
    });

    return res.json({
      success: true,
      message: 'Organization updated successfully.',
      data: updatedOrg
    });
  } catch (error) {
    logger.error('UpdateOrganization error:', error);
    next(error);
  }
}
