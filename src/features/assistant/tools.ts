import { search } from "@/features/search/service";
import { listClients, getClient } from "@/features/clients/service";
import { listProjects } from "@/features/projects/service";
import { listDeliverables } from "@/features/deliverables/service";
import { listDeals } from "@/features/deals/service";
import { listActivities } from "@/features/activities/service";
import { getClientTimeline } from "@/features/timeline/service";
import { getUpcomingRenewals } from "@/features/renewals/service";
import { listClientsQuerySchema } from "@/features/clients/schema";
import { listProjectsQuerySchema } from "@/features/projects/schema";
import { listDeliverablesQuerySchema } from "@/features/deliverables/schema";
import { listDealsQuerySchema } from "@/features/deals/schema";
import { listActivitiesQuerySchema } from "@/features/activities/schema";

/**
 * Read-only tools the in-app assistant can call. Each is a thin wrapper over an
 * existing feature service, so the assistant sees exactly the data the web app
 * would show the same (authenticated) user. Nothing here writes. Outputs are
 * trimmed to the fields the model needs, to keep token cost and latency down.
 *
 * IMPORTANT: every OPTIONAL parameter is declared nullable (`["string","null"]`).
 * gpt-oss and similar models fill unused optionals with `null`, and Groq
 * validates tool-call arguments against this schema *server-side* — a plain
 * `"string"` type there makes it reject the whole call with a 400. Declaring
 * null keeps those calls valid; `dispatchTool` then strips nulls before the
 * feature Zod schemas (which accept `undefined`, not `null`) run.
 */
export type ToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** Required string param (never null). */
const req = (description: string) => ({ type: "string", description });
/** Optional param — nullable so the model may emit null for "unused". */
const opt = (description: string) => ({ type: ["string", "null"], description });
const optNum = (description: string) => ({ type: ["number", "null"], description });
/** Optional enum param — nullable, with null added to the allowed set. */
const optEnum = (values: readonly string[], description: string) => ({
  type: ["string", "null"],
  enum: [...values, null],
  description,
});

export const assistantTools: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "search_crm",
      description:
        "Fuzzy search across clients, contacts, projects, and deals by name. Use this first when the user names an entity but you don't have its id.",
      parameters: {
        type: "object",
        properties: { query: req("The search term, e.g. a client or person name.") },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_clients",
      description: "List clients, optionally filtered by status or a name search.",
      parameters: {
        type: "object",
        properties: {
          status: optEnum(["active", "past", "prospect"], "Filter by client status."),
          q: opt("Case-insensitive name search."),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_client",
      description: "Fetch one client with its contacts. Requires the client id (use search_crm to find it).",
      parameters: {
        type: "object",
        properties: { clientId: req("The client id.") },
        required: ["clientId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_client_timeline",
      description:
        "The recent activity + notes history for a client (calls, emails, meetings, notes), newest first. Use to summarize what's happening with an account.",
      parameters: {
        type: "object",
        properties: { clientId: req("The client id."), limit: optNum("Max events (default 20).") },
        required: ["clientId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List projects (engagements), optionally filtered by client, status, service type, or name.",
      parameters: {
        type: "object",
        properties: {
          clientId: opt("Filter to a client's projects."),
          status: optEnum(["active", "on_hold", "completed", "cancelled"], "Filter by status."),
          serviceType: optEnum(["web_dev", "seo", "software_dev", "app_dev", "aigc"], "Filter by service line."),
          q: opt("Case-insensitive name search."),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_deliverables",
      description: "List deliverables (tasks), optionally filtered by project, owner, or status.",
      parameters: {
        type: "object",
        properties: {
          projectId: opt("Filter to a project's tasks."),
          ownerId: opt("Filter to a user's tasks."),
          status: optEnum(["not_started", "in_progress", "review", "done"], "Filter by status."),
          q: opt("Case-insensitive title search."),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_deals",
      description: "List sales deals, optionally filtered by client or a title search.",
      parameters: {
        type: "object",
        properties: {
          clientId: opt("Filter to a client's deals."),
          q: opt("Case-insensitive title search."),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_upcoming_renewals",
      description:
        "Active retainer engagements whose renewal date falls within the next N days, soonest first. The 'what needs attention' report.",
      parameters: {
        type: "object",
        properties: { withinDays: optNum("Lookahead window in days (default 30).") },
      },
    },
  },
];

/** Cap list results so tool payloads stay small. */
const PAGE = { page: 1, pageSize: 15 } as const;

type Args = Record<string, unknown>;

/** Null / empty-string / undefined -> undefined, so the Zod `.optional()`
 *  filters (which reject null) accept "not provided". */
const nn = (v: unknown): unknown => (v === null || v === "" || v === undefined ? undefined : v);

/**
 * Run a tool by name with the model-supplied args. Unknown tools and bad args
 * return an `{ error }` object rather than throwing, so the model can recover.
 */
export async function dispatchTool(name: string, args: Args): Promise<unknown> {
  try {
    switch (name) {
      case "search_crm": {
        const query = String(args.query ?? "").trim();
        if (!query) return { error: "query is required" };
        return (await search(query, { perType: 5 })).map((r) => ({
          type: r.type,
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
        }));
      }
      case "list_clients": {
        const q = listClientsQuerySchema.parse({ ...PAGE, status: nn(args.status), q: nn(args.q) });
        const { items, total } = await listClients(q);
        return { total, clients: items.map((c) => ({ id: c.id, name: c.name, status: c.status, industry: c.industry })) };
      }
      case "get_client": {
        const clientId = String(args.clientId ?? "");
        const c = await getClient(clientId, { withContacts: true });
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          industry: c.industry,
          website: c.website,
          contacts: c.contacts.map((ct) => ({
            name: ct.name,
            email: ct.email,
            role: ct.role,
            isPrimary: ct.isPrimary,
          })),
        };
      }
      case "get_client_timeline": {
        const clientId = String(args.clientId ?? "");
        const limit = Math.min(Number(args.limit) || 20, 50);
        return await getClientTimeline(clientId, limit);
      }
      case "list_projects": {
        const q = listProjectsQuerySchema.parse({
          ...PAGE,
          clientId: nn(args.clientId),
          status: nn(args.status),
          serviceType: nn(args.serviceType),
          q: nn(args.q),
        });
        const { items, total } = await listProjects(q);
        return {
          total,
          projects: items.map((p) => ({
            id: p.id,
            name: p.name,
            serviceType: p.serviceType,
            stage: p.stage,
            status: p.status,
            clientId: p.clientId,
          })),
        };
      }
      case "list_deliverables": {
        const q = listDeliverablesQuerySchema.parse({
          ...PAGE,
          projectId: nn(args.projectId),
          ownerId: nn(args.ownerId),
          status: nn(args.status),
          q: nn(args.q),
        });
        const { items, total } = await listDeliverables(q);
        return {
          total,
          deliverables: items.map((d) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            dueDate: d.dueDate,
            ownerId: d.ownerId,
            projectId: d.projectId,
          })),
        };
      }
      case "list_deals": {
        const q = listDealsQuerySchema.parse({ ...PAGE, clientId: nn(args.clientId), q: nn(args.q) });
        const { items, total } = await listDeals(q);
        return {
          total,
          deals: items.map((d) => ({
            id: d.id,
            title: d.title,
            value: d.value,
            stageId: d.stageId,
            clientId: d.clientId,
            closedAt: d.closedAt,
          })),
        };
      }
      case "list_activities": {
        const clientId = String(args.clientId ?? "");
        const q = listActivitiesQuerySchema.parse({ ...PAGE, type: nn(args.type), projectId: nn(args.projectId) });
        const { items, total } = await listActivities(clientId, q);
        return {
          total,
          activities: items.map((a) => ({ id: a.id, type: a.type, summary: a.summary, createdAt: a.createdAt })),
        };
      }
      case "list_upcoming_renewals": {
        const withinDays = Math.min(Number(args.withinDays) || 30, 365);
        return (await getUpcomingRenewals(withinDays)).map((p) => ({
          projectId: p.id,
          name: p.name,
          clientId: p.clientId,
          clientName: p.client.name,
          retainerRenewalDate: p.retainerRenewalDate,
          daysUntil: p.daysUntil,
        }));
      }
      default:
        return { error: `unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "tool failed" };
  }
}
