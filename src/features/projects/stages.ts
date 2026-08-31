import { ServiceType, EngagementType } from "@prisma/client";

/**
 * Stage sets per service type (SPEC "Stage Sets by Service Type").
 *
 * Stage is stored as a free-form string on Project rather than a DB enum, so
 * these workflows can evolve without a migration. This module is the single
 * source of truth for what's valid — both the API (validation) and the UI
 * (board columns, defaults) read from here.
 *
 * aigc is special: its terminal stage differs by engagement type
 * (one_off → "delivered", retainer → "ongoing_production"), so stages are
 * resolved with the engagement type in hand.
 */
const BASE_STAGES: Record<ServiceType, readonly string[]> = {
  web_dev: ["discovery", "design", "build", "qa", "launch", "complete"],
  app_dev: ["discovery", "design", "build", "qa", "launch", "complete"],
  software_dev: ["discovery", "scoping", "build", "testing", "deployment", "complete"],
  seo: ["audit", "strategy", "implementation", "ongoing_optimization"],
  // aigc's final stage is filled in by stagesFor() based on engagement type.
  aigc: ["scoping", "production", "review"],
};

/** Ordered list of valid stages for a service type (+ engagement for aigc). */
export function stagesFor(
  serviceType: ServiceType,
  engagementType: EngagementType,
): readonly string[] {
  if (serviceType === ServiceType.aigc) {
    const terminal =
      engagementType === EngagementType.retainer ? "ongoing_production" : "delivered";
    return [...BASE_STAGES.aigc, terminal];
  }
  return BASE_STAGES[serviceType];
}

/** The stage a new project starts in (the first in its set). */
export function defaultStage(
  serviceType: ServiceType,
  engagementType: EngagementType,
): string {
  return stagesFor(serviceType, engagementType)[0]!;
}

/** Whether `stage` is valid for the given service/engagement combination. */
export function isValidStage(
  serviceType: ServiceType,
  engagementType: EngagementType,
  stage: string,
): boolean {
  return stagesFor(serviceType, engagementType).includes(stage);
}

/**
 * All stages to render as board columns for a service type, independent of a
 * single project's engagement type. For aigc this includes both terminal
 * stages (one_off "delivered" and retainer "ongoing_production") so projects of
 * either engagement type have a column to sit in.
 */
export function boardStagesFor(serviceType: ServiceType): readonly string[] {
  if (serviceType === ServiceType.aigc) {
    return [...BASE_STAGES.aigc, "delivered", "ongoing_production"];
  }
  return BASE_STAGES[serviceType];
}

/** All service types, in a stable display order. */
export const SERVICE_TYPES: readonly ServiceType[] = [
  ServiceType.web_dev,
  ServiceType.app_dev,
  ServiceType.software_dev,
  ServiceType.seo,
  ServiceType.aigc,
];

/** Human-friendly label for a service type token. */
export function serviceTypeLabel(s: ServiceType): string {
  return { web_dev: "Web Dev", app_dev: "App Dev", software_dev: "Software Dev", seo: "SEO", aigc: "AIGC" }[s];
}

/** Human-friendly label for a stage token (e.g. "ongoing_optimization"). */
export function stageLabel(stage: string): string {
  return stage
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
