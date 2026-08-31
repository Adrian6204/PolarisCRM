import { describe, it, expect } from "vitest";
import { ServiceType, EngagementType } from "@prisma/client";
import {
  stagesFor,
  defaultStage,
  isValidStage,
  boardStagesFor,
  stageLabel,
} from "../stages";

describe("stagesFor", () => {
  it("returns the fixed set for web_dev regardless of engagement", () => {
    expect(stagesFor(ServiceType.web_dev, EngagementType.one_off)).toEqual([
      "discovery", "design", "build", "qa", "launch", "complete",
    ]);
  });

  it("uses software_dev's distinct pipeline", () => {
    expect(stagesFor(ServiceType.software_dev, EngagementType.retainer)).toContain("deployment");
  });

  it("varies aigc's terminal stage by engagement type", () => {
    expect(stagesFor(ServiceType.aigc, EngagementType.one_off).at(-1)).toBe("delivered");
    expect(stagesFor(ServiceType.aigc, EngagementType.retainer).at(-1)).toBe("ongoing_production");
  });
});

describe("defaultStage", () => {
  it("is the first stage of the set", () => {
    expect(defaultStage(ServiceType.seo, EngagementType.retainer)).toBe("audit");
    expect(defaultStage(ServiceType.aigc, EngagementType.one_off)).toBe("scoping");
  });
});

describe("isValidStage", () => {
  it("accepts a stage in the set and rejects one outside it", () => {
    expect(isValidStage(ServiceType.web_dev, EngagementType.one_off, "qa")).toBe(true);
    expect(isValidStage(ServiceType.web_dev, EngagementType.one_off, "audit")).toBe(false);
  });

  it("rejects the wrong aigc terminal for the engagement type", () => {
    // "ongoing_production" is only valid for retainer aigc.
    expect(isValidStage(ServiceType.aigc, EngagementType.one_off, "ongoing_production")).toBe(false);
    expect(isValidStage(ServiceType.aigc, EngagementType.retainer, "ongoing_production")).toBe(true);
  });
});

describe("boardStagesFor", () => {
  it("includes both aigc terminals so any engagement has a column", () => {
    const cols = boardStagesFor(ServiceType.aigc);
    expect(cols).toContain("delivered");
    expect(cols).toContain("ongoing_production");
  });
});

describe("stageLabel", () => {
  it("humanizes tokens", () => {
    expect(stageLabel("ongoing_optimization")).toBe("Ongoing Optimization");
  });
});
