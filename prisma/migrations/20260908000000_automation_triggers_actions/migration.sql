-- P7: additional automation triggers + a notify action.
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'contact_added';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'project_created';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'deal_lost';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'appointment_upcoming';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'task_overdue';
ALTER TYPE "AutomationActionType" ADD VALUE IF NOT EXISTS 'notify';
