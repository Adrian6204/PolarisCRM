import { StageKind } from "@prisma/client";

/** Soft chip style per stage kind (open / won / lost), theme-adaptive. */
export const STAGE_KIND_STYLES: Record<StageKind, string> = {
  open: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  won: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export const STAGE_KIND_LABELS: Record<StageKind, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};

/** Format a whole-currency-unit amount as compact USD (no cents). */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
