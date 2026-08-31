import { DealStage } from "@prisma/client";

/** Pipeline stages in board order. */
export const DEAL_STAGES: readonly DealStage[] = [
  DealStage.lead,
  DealStage.proposal,
  DealStage.won,
  DealStage.lost,
];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: "Lead",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

export const DEAL_STAGE_STYLES: Record<DealStage, string> = {
  lead: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  proposal: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  won: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

/** Format a whole-currency-unit amount as compact USD (no cents). */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
