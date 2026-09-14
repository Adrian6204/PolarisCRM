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
 * deliberately trimmed to the fields the model needs, to keep token cost and
 * latency down.
 *
 * The specs use the OpenAI/Groq function-calling shape. `dispatchTool` runs the
 * named tool with the model-supplied args and returns a compact JS value that
 * the caller serializes back into the conversation.
 */
export type ToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });

export const assistantTools: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "search_crm",
      description:
        "Fuzzy search across clients, contacts, projects, and deals by name. Use this first when the user names an entity but you don't have its id.",
      parameters: {
        type: "object",
        properties: { query: str("The search term, e.g. a client or person name.") },
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
          status: { type: "string", enum: ["active", "past", "prospect"], description: "Filter by client status." },
          q: str("Case-insensitive name search."),
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
        properties: { clientId: str("The client id.") },
        required: ["clientId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_client_timeline",
      description:
        "The recent activity + notes history for a client (calls, emails, meetings, notes), newest first. Use to summarize what's been happening with an account.",
      parameters: {
        type: "object",
        properties: { clientId: str("The client id."), limit: num("Max events (default 20).") },
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
          clientId: str("Filter to a client's projects."),
          status: { type: "string", enum: ["active", "on_hold", "completed", "cancelled"], description: "Filter by status." },
          serviceType: {
            type: "string",
            enum: ["web_dev", "seo", "software_dev", "app_dev", "aigc"],
            description: "Filter by service line.",
          },
          q: str("Case-insensitive name search."),
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
          projectId: str("Filter to a project's tasks."),
          ownerId: str("Filter to a user's tasks."),
          status: {
            type: "string",
            enum: ["not_started", "in_progress", "review", "done"],
            description: "Filter by status.",
          },
          q: str("Case-insensitive title search."),
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
          clientId: str("Filter to a client's deals."),
          q: str("Case-insensitive title search."),
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
        properties: { withinDays: num("Lookahead window in days (default 30).") },
      },
    },
  },
];

/** Cap list results so tool payloads stay small. */
const PAGE = { page: 1, pageSize: 15 } as const;

type Args = Record<string, unknown>;

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
        const q = listClientsQuerySchema.parse({ ...PAGE, status: args.status, q: args.q });
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
          clientId: args.clientId,
          status: args.status,
          serviceType: args.serviceType,
          q: args.q,
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
          projectId: args.projectId,
          ownerId: args.ownerId,
          status: args.status,
          q: args.q,
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
        const q = listDealsQuerySchema.parse({ ...PAGE, clientId: args.clientId, q: args.q });
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
        const q = listActivitiesQuerySchema.parse({ ...PAGE, type: args.type, projectId: args.projectId });
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
    // Return the message so the model can react (e.g. "client not found").
    return { error: err instanceof Error ? err.message : "tool failed" };
  }
}
