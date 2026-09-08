import { AutomationTrigger, AutomationActionType } from "@prisma/client";

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  client_created: "Client created",
  deal_stage_changed: "Deal stage changed",
  deal_won: "Deal won",
  appointment_scheduled: "Appointment scheduled",
  client_tagged: "Client tagged",
};

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  add_tag: "Add tag",
  create_note: "Create note",
  log_activity: "Log activity",
};

/**
 * Context tokens each trigger exposes — usable in conditions and as
 * `{{token}}` placeholders in action text. Drives the builder UI's hints.
 */
export const TRIGGER_TOKENS: Record<AutomationTrigger, string[]> = {
  client_created: ["clientName", "status"],
  deal_stage_changed: ["dealTitle", "value", "stageName", "stageKind", "clientName"],
  deal_won: ["dealTitle", "value", "stageName", "stageKind", "clientName"],
  appointment_scheduled: ["appointmentTitle", "clientName", "host"],
  client_tagged: ["tagName"],
};
