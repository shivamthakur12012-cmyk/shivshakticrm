import { Request, Response, NextFunction } from 'express';
import { Workflow } from '../models/Workflow';
import { AuditLog } from '../models/AuditLog';

export async function getWorkflows(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const workflows = await Workflow.find({ organizationId: orgId, isDeleted: false })
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: workflows
    });
  } catch (error) {
    next(error);
  }
}

export async function createWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { name, triggerEvent, conditions, actions } = req.body;

    const workflow = await Workflow.create({
      organizationId: orgId,
      name,
      triggerEvent,
      conditions: conditions || [],
      actions: actions || [],
      isActive: true
    });

    // System audit log
    await AuditLog.create({
      userId,
      organizationId: orgId,
      action: 'WORKFLOW_CREATED',
      entity: 'Workflow',
      entityId: workflow._id.toString(),
      newValue: { name, triggerEvent }
    });

    return res.status(201).json({
      success: true,
      data: workflow
    });
  } catch (error) {
    next(error);
  }
}

export async function updateWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, triggerEvent, conditions, actions, isActive } = req.body;

    const oldWorkflow = await Workflow.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!oldWorkflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow rule not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    const updatedWorkflow = await Workflow.findByIdAndUpdate(
      id,
      { 
        $set: { 
          name, 
          triggerEvent, 
          conditions: conditions || [], 
          actions: actions || [],
          isActive
        } 
      },
      { new: true }
    );

    // System audit log
    await AuditLog.create({
      userId,
      organizationId: orgId,
      action: 'WORKFLOW_UPDATED',
      entity: 'Workflow',
      entityId: id,
      oldValue: (oldWorkflow as any).toObject ? (oldWorkflow as any).toObject() : oldWorkflow,
      newValue: (updatedWorkflow as any)?.toObject ? (updatedWorkflow as any).toObject() : updatedWorkflow
    });

    return res.json({
      success: true,
      data: updatedWorkflow
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleWorkflowActive(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { isActive } = req.body;

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { $set: { isActive } },
      { new: true }
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow rule not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    // Audit log
    await AuditLog.create({
      userId,
      organizationId: orgId,
      action: 'WORKFLOW_TOGGLED',
      entity: 'Workflow',
      entityId: id,
      newValue: { isActive }
    });

    return res.json({
      success: true,
      message: `Workflow state updated to ${isActive ? 'Active' : 'Inactive'}.`,
      data: workflow
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow rule not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    // System audit log
    await AuditLog.create({
      userId,
      organizationId: orgId,
      action: 'WORKFLOW_DELETED',
      entity: 'Workflow',
      entityId: id
    });

    return res.json({
      success: true,
      message: 'Workflow automation deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}
