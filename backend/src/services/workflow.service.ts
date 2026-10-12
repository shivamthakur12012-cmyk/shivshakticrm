import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { Activity } from '../models/Activity';
import logger from '../utils/logger';

export class WorkflowService {
  /**
   * Evaluates active workflows for a tenant and executes actions if conditions pass.
   * @param orgId The organization context
   * @param event The triggered event type (e.g. 'lead_created')
   * @param payload The document context (e.g. Lead, Deal, or Ticket object)
   */
  static async triggerWorkflows(orgId: string, event: 'lead_created' | 'deal_stage_changed' | 'ticket_created', payload: any) {
    try {
      const workflows = await Workflow.find({
        organizationId: orgId,
        triggerEvent: event,
        isActive: true,
        isDeleted: false
      });

      if (workflows.length === 0) return;

      logger.info(`Workflow engine: Evaluating ${workflows.length} active workflows for event "${event}".`);

      for (const wf of workflows) {
        let isMatched = true;

        // 1. Evaluate all conditions (AND logic)
        for (const cond of wf.conditions) {
          const payloadVal = payload[cond.field];
          if (payloadVal === undefined) {
            isMatched = false;
            break;
          }

          if (cond.operator === 'equals') {
            if (String(payloadVal).toLowerCase() !== String(cond.value).toLowerCase()) {
              isMatched = false;
              break;
            }
          } else if (cond.operator === 'greater_than') {
            if (Number(payloadVal) <= Number(cond.value)) {
              isMatched = false;
              break;
            }
          } else if (cond.operator === 'less_than') {
            if (Number(payloadVal) >= Number(cond.value)) {
              isMatched = false;
              break;
            }
          }
        }

        // 2. If matched, run all actions
        if (isMatched) {
          logger.info(`Workflow matched: "${wf.name}" (${wf._id}). Executing ${wf.actions.length} actions.`);

          for (const action of wf.actions) {
            if (action.actionType === 'create_task') {
              const offset = Number(action.metadata.dueDateOffsetDays || 3);
              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() + offset);

              // Link task context correctly
              const customerId = payload.customerId || (payload.constructor.modelName === 'Customer' ? payload._id : null);
              const assignedTo = payload.ownerId || payload.assignedTo || null;

              await Task.create({
                organizationId: orgId,
                title: action.metadata.title || 'Automated follow-up Task',
                description: `Automatically created by workflow automation "${wf.name}".`,
                dueDate,
                status: 'pending',
                priority: 'medium',
                assignedTo,
                customerId
              });
              logger.info(`Workflow action executed: Created Task "${action.metadata.title}"`);

            } else if (action.actionType === 'send_email') {
              const customerId = payload.customerId || (payload.constructor.modelName === 'Customer' ? payload._id : null);

              // Log sending simulation in Activity history
              await Activity.create({
                organizationId: orgId,
                customerId,
                type: 'note',
                content: `[Automated Email Sent via Workflow: "${wf.name}"]\nSubject: ${action.metadata.subject}\nBody: ${action.metadata.body}`
              });
              logger.info(`Workflow action executed: Logged Email sending simulation activity.`);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Workflow trigger evaluation failed:', error);
    }
  }
}
