import { DeliverableStatus } from "@prisma/client";

/** Ordered statuses for board columns and selects. */
export const DELIVERABLE_STATUSES: readonly DeliverableStatus[] = [
  DeliverableStatus.not_started,
  DeliverableStatus.in_progress,
  DeliverableStatus.review,
  DeliverableStatus.done,
];

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};
