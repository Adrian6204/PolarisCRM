import { AutomationTrigger, AutomationActionType } from "@prisma/client";

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  client_created: "Client created",
  contact_added: "Contact added",
  project_created: "Project created",
  deal_stage_changed: "Deal stage changed",
  deal_won: "Deal won",
  deal_lost: "Deal lost",
  appointment_scheduled: "Appointment scheduled",
  appointment_upcoming: "Appointment upcoming (24h)",
  client_tagged: "Client tagged",
  task_overdue: "Task overdue",
};

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  add_tag: "Add tag",
  create_note: "Create note",
  log_activity: "Log activity",
  notify: "Notify admins",
};

/**
 * Context tokens each trigger exposes — usable in conditions and as
 * `{{token}}` placeholders in action text. Drives the builder UI's hints.
 */
export const TRIGGER_TOKENS: Record<AutomationTrigger, string[]> = {
  client_created: ["clientName", "status"],
  contact_added: ["contactName", "contactEmail", "clientName"],
  project_created: ["projectName", "serviceType", "clientName"],
  deal_stage_changed: ["dealTitle", "value", "stageName", "stageKind", "clientName"],
  deal_won: ["dealTitle", "value", "stageName", "stageKind", "clientName"],
  deal_lost: ["dealTitle", "value", "stageName", "stageKind", "clientName"],
  appointment_scheduled: ["appointmentTitle", "clientName", "host"],
  appointment_upcoming: ["appointmentTitle", "clientName", "host"],
  client_tagged: ["tagName"],
  task_overdue: ["taskTitle", "clientName"],
};
