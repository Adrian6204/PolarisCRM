import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

/**
 * Cross-entity quick search (G/P3) powering the ⌘K palette. Case-insensitive
 * "contains" over the most-jumped-to records, soft-delete-aware, capped per
 * type. Returns a flat, typed list each carrying a navigable href.
 */
export type SearchType = "client" | "contact" | "deal" | "project";

export interface SearchResult {
  type: SearchType;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export async function search(
  query: string,
  opts: { db?: PrismaClient; perType?: number } = {},
): Promise<SearchResult[]> {
  const db = opts.db ?? defaultPrisma;
  const q = query.trim();
  if (q.length < 1) return [];
  const take = opts.perType ?? 5;
  const contains = { contains: q, mode: "insensitive" as const };

  const [clients, contacts, deals, projects] = await Promise.all([
    db.client.findMany({
      where: { deletedAt: null, OR: [{ name: contains }, { industry: contains }] },
      select: { id: true, name: true, industry: true },
      take,
      orderBy: { name: "asc" },
    }),
    db.contact.findMany({
      where: { OR: [{ name: contains }, { email: contains }], client: { deletedAt: null } },
      select: { id: true, name: true, email: true, clientId: true, client: { select: { name: true } } },
      take,
    }),
    db.deal.findMany({
      where: { deletedAt: null, title: contains },
      select: { id: true, title: true, client: { select: { name: true } } },
      take,
      orderBy: { createdAt: "desc" },
    }),
    db.project.findMany({
      where: { deletedAt: null, name: contains },
      select: { id: true, name: true, client: { select: { name: true } } },
      take,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return [
    ...clients.map((c): SearchResult => ({ type: "client", id: c.id, title: c.name, subtitle: c.industry ?? undefined, href: `/clients/${c.id}` })),
    ...contacts.map((c): SearchResult => ({ type: "contact", id: c.id, title: c.name, subtitle: `${c.email} · ${c.client.name}`, href: `/clients/${c.clientId}` })),
    ...deals.map((d): SearchResult => ({ type: "deal", id: d.id, title: d.title, subtitle: d.client.name, href: `/deals/${d.id}` })),
    ...projects.map((p): SearchResult => ({ type: "project", id: p.id, title: p.name, subtitle: p.client.name, href: `/projects/${p.id}` })),
  ];
}
