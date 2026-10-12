import { Request, Response, NextFunction } from 'express';
import { Deal } from '../models/Deal';
import { Pipeline } from '../models/Pipeline';
import { Activity } from '../models/Activity';
import { AuditLog } from '../models/AuditLog';
import { WorkflowService } from '../services/workflow.service';

// Fetch Custom Pipelines & Stages
export async function getPipelines(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const pipelines = await Pipeline.find({ organizationId: orgId });

    return res.json({
      success: true,
      data: pipelines
    });
  } catch (error) {
    next(error);
  }
}

// Create custom pipeline (wizard/admin settings)
export async function createPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { name, stages } = req.body;

    const pipeline = await Pipeline.create({
      organizationId: orgId,
      name,
      stages: stages.map((s: any, idx: number) => ({
        name: s.name,
        probability: s.probability,
        order: idx
      }))
    });

    return res.status(201).json({
      success: true,
      data: pipeline
    });
  } catch (error) {
    next(error);
  }
}

// Get all deals inside organization
export async function getDeals(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { pipelineId, status, ownerId } = req.query;

    const query: any = { organizationId: orgId, isDeleted: false };
    if (pipelineId) query.pipelineId = pipelineId;
    if (status) query.status = status;
    if (ownerId) query.ownerId = ownerId;

    const deals = await Deal.find(query)
      .populate('customerId', 'name companyName email phone')
      .populate('ownerId', 'firstName lastName')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: deals
    });
  } catch (error) {
    next(error);
  }
}

export async function getDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const deal = await Deal.findOne({ _id: id, organizationId: orgId, isDeleted: false })
      .populate('customerId', 'name companyName email phone')
      .populate('ownerId', 'firstName lastName')
      .populate('pipelineId');

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal record not found.',
        errorCode: 'DEAL_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: deal
    });
  } catch (error) {
    next(error);
  }
}

export async function createDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { title, customerId, leadId, pipelineId, stageId, amount, expectedCloseDate, notes } = req.body;

    // Fetch pipeline and find stage to get default probability
    const pipeline = await Pipeline.findOne({ _id: pipelineId, organizationId: orgId });
    if (!pipeline) {
      return res.status(400).json({
        success: false,
        message: 'Selected pipeline not found.',
        errorCode: 'BAD_REQUEST'
      });
    }

    const stage = (pipeline.stages || []).find((s: any) => (s._id || s.id)?.toString() === stageId);
    const probability = stage ? stage.probability : 0;

    const deal = await Deal.create({
      organizationId: orgId,
      title,
      customerId,
      leadId,
      ownerId: userId,
      pipelineId,
      stageId,
      amount,
      probability,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      notes,
      status: 'open'
    });

    // Timeline Log
    await Activity.create({
      organizationId: orgId,
      customerId,
      leadId,
      dealId: deal._id,
      userId,
      type: 'status_change',
      content: `Deal "${title}" created at stage "${stage?.name || 'Initial'}".`
    });

    return res.status(201).json({
      success: true,
      data: deal
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { title, amount, expectedCloseDate, notes, status, lostReason } = req.body;

    const oldDeal = await Deal.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!oldDeal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found.',
        errorCode: 'DEAL_NOT_FOUND'
      });
    }

    const updatedDeal = await Deal.findByIdAndUpdate(
      id,
      { 
        $set: { 
          title, 
          amount, 
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined, 
          notes,
          status,
          lostReason 
        } 
      },
      { new: true }
    );

    // Audit log if status changes
    if (status && oldDeal.status !== status) {
      await Activity.create({
        organizationId: orgId,
        customerId: oldDeal.customerId,
        dealId: id,
        userId,
        type: 'status_change',
        content: `Deal status updated to "${status.toUpperCase()}".`
      });
    }

    return res.json({
      success: true,
      data: updatedDeal
    });
  } catch (error) {
    next(error);
  }
}

// Kanban Stage change update
export async function updateDealStage(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { stageId } = req.body;

    const deal = await Deal.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found.',
        errorCode: 'DEAL_NOT_FOUND'
      });
    }

    // Fetch the stage details from the pipeline
    const pipeline = await Pipeline.findOne({ _id: deal.pipelineId, organizationId: orgId });
    if (!pipeline) {
      return res.status(400).json({
        success: false,
        message: 'Associated pipeline not found.',
        errorCode: 'BAD_REQUEST'
      });
    }

    const oldStage = (pipeline.stages || []).find((s: any) => (s._id || s.id)?.toString() === deal.stageId?.toString());
    const newStage = (pipeline.stages || []).find((s: any) => (s._id || s.id)?.toString() === stageId);

    if (!newStage) {
      return res.status(400).json({
        success: false,
        message: 'Selected stage not found in pipeline.',
        errorCode: 'BAD_REQUEST'
      });
    }

    // Update deal
    deal.stageId = String(newStage._id || newStage.id);
    deal.probability = newStage.probability;

    // Auto status resolving based on stage names
    const stageNameLower = newStage.name.toLowerCase();
    if (stageNameLower.includes('won') || stageNameLower.includes('closed won') || stageNameLower.includes('disbursed') || stageNameLower.includes('certificate delivered')) {
      deal.status = 'won';
    } else if (stageNameLower.includes('lost') || stageNameLower.includes('closed lost') || stageNameLower.includes('cancelled')) {
      deal.status = 'lost';
    } else {
      deal.status = 'open'; // Re-open if dragged out of won/lost
    }

    await deal.save();

    // Timeline Log
    await Activity.create({
      organizationId: orgId,
      customerId: deal.customerId,
      leadId: deal.leadId,
      dealId: deal._id,
      userId,
      type: 'status_change',
      content: `Moved stage from "${oldStage?.name || 'Initial'}" to "${newStage.name}" (Win probability: ${newStage.probability}%).`
    });

    // Trigger automation workflows
    await WorkflowService.triggerWorkflows(orgId as string, 'deal_stage_changed', deal);

    return res.json({
      success: true,
      message: 'Deal stage updated successfully.',
      data: deal
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const deal = await Deal.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found.',
        errorCode: 'DEAL_NOT_FOUND'
      });
    }

    // Audit log
    await AuditLog.create({
      userId: req.user?.id,
      organizationId: orgId,
      action: 'DEAL_DELETED',
      entity: 'Deal',
      entityId: id
    });

    return res.json({
      success: true,
      message: 'Deal deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}
