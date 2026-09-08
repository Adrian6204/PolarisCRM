import { logger } from "@/lib/logger";
import { runAutomations, type AutomationEvent } from "./engine";

/**
 * Fire-and-forget entry point used by feature services after a write. Runs the
 * automation engine inline against the default prisma client, but never lets a
 * failure (or a downed dependency) break the triggering request — automations
 * are a side effect, not part of the write's contract.
 *
 * Callers gate this to the real runtime path (they skip it when a test injects
 * a mock db), so unit tests of the feature services don't hit the engine.
 */
export async function emitAutomationEvent(event: AutomationEvent): Promise<void> {
  try {
    await runAutomations(event, { log: logger });
  } catch (err) {
    logger.error({ err, trigger: event.trigger }, "automation dispatch failed");
  }
}
