import { z } from "zod";
import { Role } from "@prisma/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assertRole } from "@/lib/auth";
import { guard, jsonResult, textResult, toShape, writeOpts } from "./context";

// Feature schemas (source of truth for validation) ...
import {
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
} from "@/features/clients/schema";
import { createProjectSchema, updateProjectSchema, listProjectsQuerySchema } from "@/features/projects/schema";
import {
  createDeliverableSchema,
  updateDeliverableSchema,
  listDeliverablesQuerySchema,
} from "@/features/deliverables/schema";
import { createDealSchema, updateDealSchema, listDealsQuerySchema } from "@/features/deals/schema";
import { createActivitySchema, listActivitiesQuerySchema } from "@/features/activities/schema";

// ... and the services they validate for.
import {
  createClient,
  updateClient,
  softDeleteClient,
  listClients,
  getClient,
} from "@/features/clients/service";
import {
  createProject,
  updateProject,
  softDeleteProject,
  listProjects,
  getProject,
} from "@/features/projects/service";
import {
  createDeliverable,
  updateDeliverable,
  softDeleteDeliverable,
  listDeliverables,
} from "@/features/deliverables/service";
import {
  createDeal,
  updateDeal,
  softDeleteDeal,
  listDeals,
  getDeal,
} from "@/features/deals/service";
import { createActivity, listActivities, deleteActivity } from "@/features/activities/service";
import { getClientTimeline } from "@/features/timeline/service";
import { search } from "@/features/search/service";
import { getUpcomingRenewals } from "@/features/renewals/service";

/** Roles allowed to mutate core records — matches the web write routes. */
const WRITERS = [Role.admin, Role.project_lead];
/** A confirm flag every destructive tool carries (see the confirm gate below). */
const confirmField = {
  confirm: z
    .boolean()
    .default(false)
    .describe("Must be true to actually perform the deletion. Call once without it to preview."),
};

export const SERVER_INFO = { name: "polaris-crm", version: "1.0.0" } as const;

/**
 * Register every Polaris CRM tool on the given MCP server. Each tool is a thin
 * adapter over an existing feature service: it re-validates input with the same
 * Zod schema the HTTP route uses and runs under the same role gate, so audit
 * logging, automations, and soft-delete semantics are identical to the web app.
 * The actor is resolved from the request's API key (see ./auth) and carried on
 * `extra.authInfo`; `guard` pulls it out and enforces authorization.
 */
export function registerTools(server: McpServer): void {
  // --- Reads (any authenticated user) --------------------------------------

  server.registerTool(
    "search_crm",
    {
      title: "Search CRM",
      description:
        "Global fuzzy search across clients, contacts, deals, and projects. Best starting point when you have a name but not an id.",
      inputSchema: {
        query: z.string().min(1).describe("Free-text search term."),
        perType: z.coerce.number().int().min(1).max(25).optional().describe("Max results per entity type (default 5)."),
      },
      annotations: { readOnlyHint: true },
    },
    guard("search_crm", { tier: "read" }, async ({ query, perType }) =>
      jsonResult(await search(query, { perType })),
    ),
  );

  server.registerTool(
    "list_clients",
    {
      title: "List clients",
      description: "List clients with optional status/tag filters and free-text name search. Paginated.",
      inputSchema: toShape(listClientsQuerySchema),
      annotations: { readOnlyHint: true },
    },
    guard("list_clients", { tier: "read" }, async (args) =>
      jsonResult(await listClients(listClientsQuerySchema.parse(args))),
    ),
  );

  server.registerTool(
    "get_client",
    {
      title: "Get client",
      description: "Fetch one client by id, optionally including its contacts.",
      inputSchema: {
        id: z.string().describe("Client id."),
        withContacts: z.boolean().optional().describe("Include the client's contacts."),
      },
      annotations: { readOnlyHint: true },
    },
    guard("get_client", { tier: "read" }, async ({ id, withContacts }) =>
      jsonResult(
        withContacts ? await getClient(id, { withContacts: true }) : await getClient(id),
      ),
    ),
  );

  server.registerTool(
    "get_client_timeline",
    {
      title: "Get client timeline",
      description:
        "The unified reverse-chronological history for a client — logged activities (calls/emails/meetings/notes) merged with free-form notes. Use to 'catch up' on an account.",
      inputSchema: {
        clientId: z.string().describe("Client id."),
        limit: z.coerce.number().int().min(1).max(500).optional().describe("Max events (default 100)."),
      },
      annotations: { readOnlyHint: true },
    },
    guard("get_client_timeline", { tier: "read" }, async ({ clientId, limit }) =>
      jsonResult(await getClientTimeline(clientId, limit)),
    ),
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List projects (engagements) with optional client/service/status filters. Paginated.",
      inputSchema: toShape(listProjectsQuerySchema),
      annotations: { readOnlyHint: true },
    },
    guard("list_projects", { tier: "read" }, async (args) =>
      jsonResult(await listProjects(listProjectsQuerySchema.parse(args))),
    ),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Fetch one project by id.",
      inputSchema: { id: z.string().describe("Project id.") },
      annotations: { readOnlyHint: true },
    },
    guard("get_project", { tier: "read" }, async ({ id }) => jsonResult(await getProject(id))),
  );

  server.registerTool(
    "list_deliverables",
    {
      title: "List deliverables",
      description: "List deliverables (tasks) with optional project/owner/status filters. Paginated.",
      inputSchema: toShape(listDeliverablesQuerySchema),
      annotations: { readOnlyHint: true },
    },
    guard("list_deliverables", { tier: "read" }, async (args) =>
      jsonResult(await listDeliverables(listDeliverablesQuerySchema.parse(args))),
    ),
  );

  server.registerTool(
    "list_deals",
    {
      title: "List deals",
      description: "List sales deals with optional client/pipeline/stage/owner filters. Paginated.",
      inputSchema: toShape(listDealsQuerySchema),
      annotations: { readOnlyHint: true },
    },
    guard("list_deals", { tier: "read" }, async (args) =>
      jsonResult(await listDeals(listDealsQuerySchema.parse(args))),
    ),
  );

  server.registerTool(
    "get_deal",
    {
      title: "Get deal",
      description: "Fetch one deal by id.",
      inputSchema: { id: z.string().describe("Deal id.") },
      annotations: { readOnlyHint: true },
    },
    guard("get_deal", { tier: "read" }, async ({ id }) => jsonResult(await getDeal(id))),
  );

  server.registerTool(
    "list_activities",
    {
      title: "List client activities",
      description: "List the logged interactions for a client (calls, emails, meetings, notes). Paginated.",
      inputSchema: toShape(listActivitiesQuerySchema, { clientId: z.string().describe("Client id.") }),
      annotations: { readOnlyHint: true },
    },
    guard("list_activities", { tier: "read" }, async (args) => {
      const { clientId, ...query } = args as { clientId: string } & Record<string, unknown>;
      return jsonResult(await listActivities(clientId, listActivitiesQuerySchema.parse(query)));
    }),
  );

  server.registerTool(
    "list_upcoming_renewals",
    {
      title: "List upcoming retainer renewals",
      description:
        "Active retainer engagements whose renewal date falls within the next N days, soonest first. The key 'what needs attention' report for an agency.",
      inputSchema: {
        withinDays: z.coerce.number().int().min(1).max(365).optional().describe("Lookahead window in days (default 30)."),
      },
      annotations: { readOnlyHint: true },
    },
    guard("list_upcoming_renewals", { tier: "read" }, async ({ withinDays }) =>
      jsonResult(await getUpcomingRenewals(withinDays)),
    ),
  );

  // --- Writes: activities (any authenticated user) -------------------------

  server.registerTool(
    "log_activity",
    {
      title: "Log an activity",
      description:
        "Record an interaction (call/email/meeting/note) against a client, optionally tied to a project. The core 'read an email → log the call' action.",
      inputSchema: toShape(createActivitySchema, { clientId: z.string().describe("Client id the activity belongs to.") }),
      annotations: { readOnlyHint: false },
    },
    guard("log_activity", { tier: "write" }, async (args, { actor, log }) => {
      const { clientId, ...rest } = args as { clientId: string } & Record<string, unknown>;
      const input = createActivitySchema.parse(rest);
      return jsonResult(await createActivity(clientId, input, actor.id, { log }));
    }),
  );

  // --- Writes: clients (admin / project_lead) ------------------------------

  server.registerTool(
    "create_client",
    {
      title: "Create client",
      description: "Create a new client record.",
      inputSchema: toShape(createClientSchema),
      annotations: { readOnlyHint: false },
    },
    guard("create_client", { roles: WRITERS, tier: "write" }, async (args, { actor, log }) =>
      jsonResult(await createClient(createClientSchema.parse(args), writeOpts(actor, log))),
    ),
  );

  server.registerTool(
    "update_client",
    {
      title: "Update client",
      description: "Update fields on an existing client. Provide at least one field to change.",
      inputSchema: toShape(updateClientSchema, { id: z.string().describe("Client id.") }),
      annotations: { readOnlyHint: false },
    },
    guard("update_client", { roles: WRITERS, tier: "write" }, async (args, { actor, log }) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return jsonResult(await updateClient(id, updateClientSchema.parse(rest), writeOpts(actor, log)));
    }),
  );

  server.registerTool(
    "delete_client",
    {
      title: "Delete client",
      description:
        "Soft-delete a client (recoverable). Preview first: call without confirm to see what will be removed, then call again with confirm=true.",
      inputSchema: { id: z.string().describe("Client id."), ...confirmField },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    guard("delete_client", { roles: WRITERS, tier: "write" }, async ({ id, confirm }, { actor, log }) => {
      const client = await getClient(id);
      if (!confirm) {
        return textResult(
          `About to soft-delete client "${client.name}" (${id}). This hides it and all its projects/deals from the app but is recoverable. Re-call delete_client with confirm=true to proceed.`,
        );
      }
      await softDeleteClient(id, writeOpts(actor, log));
      return textResult(`Deleted client "${client.name}" (${id}).`);
    }),
  );

  // --- Writes: projects (admin / project_lead) -----------------------------

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description:
        "Create a project (engagement) under a client. `stage` must belong to the service/engagement's stage set; omit it to default to the first stage.",
      inputSchema: toShape(createProjectSchema, { clientId: z.string().describe("Client id to create the project under.") }),
      annotations: { readOnlyHint: false },
    },
    guard("create_project", { roles: WRITERS, tier: "write" }, async (args, { actor, log }) => {
      const { clientId, ...rest } = args as { clientId: string } & Record<string, unknown>;
      return jsonResult(await createProject(clientId, createProjectSchema.parse(rest), writeOpts(actor, log)));
    }),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description:
        "Update a project — stage transitions, status, dates, name. Service/engagement type cannot be changed here.",
      inputSchema: toShape(updateProjectSchema, { id: z.string().describe("Project id.") }),
      annotations: { readOnlyHint: false },
    },
    guard("update_project", { roles: WRITERS, tier: "write" }, async (args, { actor, log }) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return jsonResult(await updateProject(id, updateProjectSchema.parse(rest), writeOpts(actor, log)));
    }),
  );

  server.registerTool(
    "delete_project",
    {
      title: "Delete project",
      description: "Soft-delete a project (recoverable). Preview first; re-call with confirm=true to proceed.",
      inputSchema: { id: z.string().describe("Project id."), ...confirmField },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    guard("delete_project", { roles: WRITERS, tier: "write" }, async ({ id, confirm }, { actor, log }) => {
      const project = await getProject(id);
      if (!confirm) {
        return textResult(
          `About to soft-delete project "${project.name}" (${id}) and its deliverables. Re-call delete_project with confirm=true to proceed.`,
        );
      }
      await softDeleteProject(id, writeOpts(actor, log));
      return textResult(`Deleted project "${project.name}" (${id}).`);
    }),
  );

  // --- Writes: deliverables ------------------------------------------------

  server.registerTool(
    "create_deliverable",
    {
      title: "Create deliverable",
      description: "Create a deliverable (task) under a project. Owner and due date are optional.",
      inputSchema: toShape(createDeliverableSchema, { projectId: z.string().describe("Project id to create the task under.") }),
      annotations: { readOnlyHint: false },
    },
    guard("create_deliverable", { roles: WRITERS, tier: "write" }, async (args, { actor, log }) => {
      const { projectId, ...rest } = args as { projectId: string } & Record<string, unknown>;
      return jsonResult(await createDeliverable(projectId, createDeliverableSchema.parse(rest), writeOpts(actor, log)));
    }),
  );

  server.registerTool(
    "update_deliverable",
    {
      title: "Update deliverable",
      description:
        "Update a deliverable. Any team member may change only its status (fast board moves); changing other fields requires admin or project lead.",
      inputSchema: toShape(updateDeliverableSchema, { id: z.string().describe("Deliverable id.") }),
      annotations: { readOnlyHint: false },
    },
    // Role is enforced inside: status-only edits are open to any member, matching the PATCH route.
    guard("update_deliverable", { tier: "write" }, async (args, { actor, log }) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      const input = updateDeliverableSchema.parse(rest);
      const onlyStatus = Object.keys(input).length === 1 && "status" in input;
      if (!onlyStatus) assertRole(actor.role, ...WRITERS);
      return jsonResult(await updateDeliverable(id, input, writeOpts(actor, log)));
    }),
  );

  server.registerTool(
    "delete_deliverable",
    {
      title: "Delete deliverable",
      description: "Soft-delete a deliverable (recoverable). Preview first; re-call with confirm=true to proceed.",
      inputSchema: { id: z.string().describe("Deliverable id."), ...confirmField },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    guard("delete_deliverable", { roles: WRITERS, tier: "write" }, async ({ id, confirm }, { actor, log }) => {
      if (!confirm) {
        return textResult(`About to soft-delete deliverable ${id}. Re-call delete_deliverable with confirm=true to proceed.`);
      }
      await softDeleteDeliverable(id, writeOpts(actor, log));
      return textResult(`Deleted deliverable ${id}.`);
    }),
  );

  // --- Writes: deals -------------------------------------------------------

  server.registerTool(
    "create_deal",
    {
      title: "Create deal",
      description:
        "Create a sales deal for a client on a given pipeline + stage. Winning the deal (a 'won' stage) auto-promotes a prospect client to active.",
      inputSchema: toShape(createDealSchema, { clientId: z.string().describe("Client id the deal belongs to.") }),
      annotations: { readOnlyHint: false },
    },
    guard("create_deal", { roles: WRITERS, tier: "write" }, async (args, { log }) => {
      const { clientId, ...rest } = args as { clientId: string } & Record<string, unknown>;
      return jsonResult(await createDeal(clientId, createDealSchema.parse(rest), { log }));
    }),
  );

  server.registerTool(
    "update_deal",
    {
      title: "Update deal",
      description:
        "Update a deal — move it along its pipeline stages, change value/owner/notes. Cannot move a deal across pipelines.",
      inputSchema: toShape(updateDealSchema, { id: z.string().describe("Deal id.") }),
      annotations: { readOnlyHint: false },
    },
    guard("update_deal", { roles: WRITERS, tier: "write" }, async (args, { log }) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return jsonResult(await updateDeal(id, updateDealSchema.parse(rest), { log }));
    }),
  );

  server.registerTool(
    "delete_deal",
    {
      title: "Delete deal",
      description: "Soft-delete a deal (recoverable). Preview first; re-call with confirm=true to proceed.",
      inputSchema: { id: z.string().describe("Deal id."), ...confirmField },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    guard("delete_deal", { roles: WRITERS, tier: "write" }, async ({ id, confirm }, { log }) => {
      const deal = await getDeal(id);
      if (!confirm) {
        return textResult(`About to soft-delete deal "${deal.title}" (${id}). Re-call delete_deal with confirm=true to proceed.`);
      }
      await softDeleteDeal(id, { log });
      return textResult(`Deleted deal "${deal.title}" (${id}).`);
    }),
  );

  server.registerTool(
    "delete_activity",
    {
      title: "Delete activity",
      description:
        "Hard-delete a logged activity (the activity log is append-only, so this is irreversible). Preview first; re-call with confirm=true to proceed.",
      inputSchema: { id: z.string().describe("Activity id."), ...confirmField },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    guard("delete_activity", { roles: WRITERS, tier: "write" }, async ({ id, confirm }, { log }) => {
      if (!confirm) {
        return textResult(`About to permanently delete activity ${id}. This cannot be undone. Re-call delete_activity with confirm=true to proceed.`);
      }
      await deleteActivity(id, { log });
      return textResult(`Deleted activity ${id}.`);
    }),
  );
}
