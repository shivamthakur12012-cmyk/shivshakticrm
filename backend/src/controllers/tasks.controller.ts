import { Request, Response, NextFunction } from 'express';
import { Task } from '../models/Task';
import { Activity } from '../models/Activity';

export async function getTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const userId = req.user?.id;
    const { status, priority, assignedTo } = req.query;

    const query: any = { organizationId: orgId };

    if (!isPrivileged && userId) {
      query.assignedTo = userId;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tasks = await Task.find(query)
      .populate('leadId', 'name company leadId')
      .populate('customerId', 'name companyName customerId')
      .populate('assignedTo', 'firstName lastName')
      .sort({ dueDate: 1, createdAt: -1 });

    return res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userRole = (req as any).userRole;
    const isPrivileged = ['Admin', 'Super Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const userId = req.user?.id;
    const { title, description, assignedTo, leadId, customerId, dealId, caseId, dueDate, priority } = req.body;

    const targetAssignedTo = isPrivileged ? (assignedTo || userId) : userId;

    const task = await Task.create({
      organizationId: orgId,
      title,
      description,
      assignedTo: targetAssignedTo,
      leadId,
      customerId,
      dealId,
      caseId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      priority,
      status: 'pending'
    });

    // Log Activity timeline if linked
    if (leadId) {
      await Activity.create({
        organizationId: orgId,
        leadId,
        userId,
        type: 'note',
        content: `Created Task: "${title}" (Due: ${dueDate ? new Date(dueDate).toLocaleDateString() : 'None'}).`
      });
    }

    return res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { status, title, description, assignedTo, dueDate, priority } = req.body;

    const oldTask = await Task.findOne({ _id: id, organizationId: orgId });
    if (!oldTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { $set: { status, title, description, assignedTo, dueDate, priority } },
      { new: true }
    );

    // Timeline logging on completion
    if (status && oldTask.status !== status && status === 'completed' && oldTask.leadId) {
      await Activity.create({
        organizationId: orgId,
        leadId: oldTask.leadId,
        userId,
        type: 'note',
        content: `Completed Task: "${oldTask.title}".`
      });
    }

    return res.json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const task = await Task.findOneAndDelete({ _id: id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      message: 'Task deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}
