import type { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Unified per-client timeline (GHL-style contact history): activities and notes
 * merged into one reverse-chronological feed. Each event is a discriminated
 * union so the UI can render the right affordance. Kept read-only; writes go
 * through the activity/note services.
 */
export type TimelineEvent =
  | {
      kind: "activity";
      id: string;
      at: string; // ISO
      activityType: ActivityType;
      summary: string;
      actor: string | null;
      project: { id: string; name: string } | null;
    }
  | {
      kind: "note";
      id: string;
      at: string; // ISO
      body: string;
      actor: string | null;
    };

const actorName = (u: { name: string | null; email: string } | null) =>
  u ? (u.name ?? u.email) : null;

export async function getClientTimeline(
  clientId: string,
  limit = 100,
): Promise<TimelineEvent[]> {
  const [activities, notes] = await Promise.all([
    prisma.activity.findMany({
      where: { clientId },
      include: {
        createdBy: { select: { name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.note.findMany({
      where: { clientId },
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const events: TimelineEvent[] = [
    ...activities.map(
      (a): TimelineEvent => ({
        kind: "activity",
        id: a.id,
        at: a.createdAt.toISOString(),
        activityType: a.type,
        summary: a.summary,
        actor: actorName(a.createdBy),
        project: a.project ? { id: a.project.id, name: a.project.name } : null,
      }),
    ),
    ...notes.map(
      (n): TimelineEvent => ({
        kind: "note",
        id: n.id,
        at: n.createdAt.toISOString(),
        body: n.body,
        actor: actorName(n.createdBy),
      }),
    ),
  ];

  events.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  return events.slice(0, limit);
}
