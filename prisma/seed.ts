/**
 * Local dev seed. Idempotent (upserts by unique keys) so it can be re-run.
 * Phase 0 seeds only the auth users — one per role — so you can log in and
 * exercise role-based access immediately. Feature fixtures (clients, projects)
 * are added to this script as those phases land.
 *
 * Run with: npm run db:seed
 */
import {
  PrismaClient,
  Role,
  ClientStatus,
  ContactRole,
  ServiceType,
  EngagementType,
  ProjectStatus,
  DeliverableStatus,
  ActivityType,
} from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { defaultStage } from "../src/features/projects/stages";

const prisma = new PrismaClient();

const USERS: Array<{ email: string; name: string; role: Role; password: string }> = [
  { email: "admin@polaris.dev", name: "Ada Admin", role: Role.admin, password: "password123" },
  { email: "lead@polaris.dev", name: "Leo Lead", role: Role.project_lead, password: "password123" },
  { email: "member@polaris.dev", name: "Mia Member", role: Role.team_member, password: "password123" },
];

// Sample clients keyed by a stable slug so re-seeding is idempotent (we look
// them up by name before creating). Each carries a primary contact + extras.
const CLIENTS: Array<{
  name: string;
  industry: string;
  website: string;
  status: ClientStatus;
  contacts: Array<{
    name: string;
    email: string;
    phone?: string;
    role: ContactRole;
    isPrimary?: boolean;
  }>;
}> = [
  {
    name: "Northwind Retail",
    industry: "E-commerce",
    website: "https://northwind.example.com",
    status: ClientStatus.active,
    contacts: [
      { name: "Grace Hopper", email: "grace@northwind.example.com", role: ContactRole.decision_maker, isPrimary: true, phone: "+1 555 0100" },
      { name: "Dev Patel", email: "dev@northwind.example.com", role: ContactRole.technical_poc },
    ],
  },
  {
    name: "Acme Software",
    industry: "SaaS",
    website: "https://acme.example.com",
    status: ClientStatus.prospect,
    contacts: [
      { name: "Wile Coyote", email: "wile@acme.example.com", role: ContactRole.billing, isPrimary: true },
    ],
  },
  {
    name: "Helios Media",
    industry: "Marketing",
    website: "https://helios.example.com",
    status: ClientStatus.past,
    contacts: [],
  },
];

async function main() {
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: hashPassword(u.password),
      },
    });
    console.log(`seeded user ${u.email} (${u.role})`);
  }

  for (const c of CLIENTS) {
    const existing = await prisma.client.findFirst({ where: { name: c.name } });
    if (existing) {
      console.log(`client ${c.name} already present — skipping`);
      continue;
    }
    await prisma.client.create({
      data: {
        name: c.name,
        industry: c.industry,
        website: c.website,
        status: c.status,
        contacts: { create: c.contacts },
      },
    });
    console.log(`seeded client ${c.name} (${c.contacts.length} contacts)`);
  }

  // Sample projects, attached to seeded clients by name. Stage defaults to the
  // first in each service/engagement set. Idempotent by (client, name).
  const PROJECTS: Array<{
    client: string;
    name: string;
    serviceType: ServiceType;
    engagementType: EngagementType;
    status: ProjectStatus;
    startDate: string;
    retainerRenewalDate?: string;
  }> = [
    { client: "Northwind Retail", name: "Storefront Rebuild", serviceType: ServiceType.web_dev, engagementType: EngagementType.one_off, status: ProjectStatus.active, startDate: "2026-06-01" },
    { client: "Northwind Retail", name: "SEO Retainer", serviceType: ServiceType.seo, engagementType: EngagementType.retainer, status: ProjectStatus.active, startDate: "2026-01-15", retainerRenewalDate: "2026-09-15" },
    { client: "Acme Software", name: "Marketing Site", serviceType: ServiceType.web_dev, engagementType: EngagementType.one_off, status: ProjectStatus.on_hold, startDate: "2026-07-01" },
    { client: "Acme Software", name: "Content Engine", serviceType: ServiceType.aigc, engagementType: EngagementType.retainer, status: ProjectStatus.active, startDate: "2026-05-01", retainerRenewalDate: "2026-11-01" },
  ];

  for (const p of PROJECTS) {
    const client = await prisma.client.findFirst({ where: { name: p.client } });
    if (!client) continue;
    const existing = await prisma.project.findFirst({
      where: { clientId: client.id, name: p.name },
    });
    if (existing) {
      console.log(`project ${p.name} already present — skipping`);
      continue;
    }
    await prisma.project.create({
      data: {
        clientId: client.id,
        name: p.name,
        serviceType: p.serviceType,
        engagementType: p.engagementType,
        stage: defaultStage(p.serviceType, p.engagementType),
        status: p.status,
        startDate: new Date(p.startDate),
        retainerRenewalDate: p.retainerRenewalDate ? new Date(p.retainerRenewalDate) : null,
      },
    });
    console.log(`seeded project ${p.name} (${p.serviceType})`);
  }

  // Sample deliverables, attached to seeded projects by name and optionally
  // owned by a seeded user (by email). Idempotent by (project, title).
  const DELIVERABLES: Array<{
    project: string;
    title: string;
    ownerEmail?: string;
    dueDate?: string;
    status: DeliverableStatus;
  }> = [
    { project: "Storefront Rebuild", title: "Homepage wireframes", ownerEmail: "lead@polaris.dev", dueDate: "2026-09-10", status: DeliverableStatus.in_progress },
    { project: "Storefront Rebuild", title: "Product page build", ownerEmail: "member@polaris.dev", dueDate: "2026-09-20", status: DeliverableStatus.not_started },
    { project: "SEO Retainer", title: "Technical SEO audit", ownerEmail: "member@polaris.dev", dueDate: "2026-09-05", status: DeliverableStatus.review },
    { project: "SEO Retainer", title: "Backlink report", status: DeliverableStatus.not_started },
    { project: "Content Engine", title: "Prompt templates", ownerEmail: "lead@polaris.dev", dueDate: "2026-09-12", status: DeliverableStatus.done },
  ];

  for (const d of DELIVERABLES) {
    const project = await prisma.project.findFirst({ where: { name: d.project } });
    if (!project) continue;
    const existing = await prisma.deliverable.findFirst({
      where: { projectId: project.id, title: d.title },
    });
    if (existing) {
      console.log(`deliverable ${d.title} already present — skipping`);
      continue;
    }
    const owner = d.ownerEmail
      ? await prisma.user.findUnique({ where: { email: d.ownerEmail } })
      : null;
    await prisma.deliverable.create({
      data: {
        projectId: project.id,
        title: d.title,
        ownerId: owner?.id ?? null,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        status: d.status,
      },
    });
    console.log(`seeded deliverable ${d.title} (${d.status})`);
  }

  // Sample activity entries for the Northwind feed. Idempotent by (client,
  // summary). project is optional (client-level activity is allowed).
  const ACTIVITIES: Array<{
    client: string;
    project?: string;
    type: ActivityType;
    summary: string;
    byEmail: string;
  }> = [
    { client: "Northwind Retail", project: "Storefront Rebuild", type: ActivityType.meeting, summary: "Kickoff meeting — scoped the storefront rebuild, agreed on Sept launch.", byEmail: "lead@polaris.dev" },
    { client: "Northwind Retail", type: ActivityType.email, summary: "Sent the SEO retainer proposal for renewal.", byEmail: "member@polaris.dev" },
  ];

  for (const a of ACTIVITIES) {
    const client = await prisma.client.findFirst({ where: { name: a.client } });
    if (!client) continue;
    const existing = await prisma.activity.findFirst({
      where: { clientId: client.id, summary: a.summary },
    });
    if (existing) {
      console.log(`activity already present — skipping`);
      continue;
    }
    const project = a.project
      ? await prisma.project.findFirst({ where: { name: a.project } })
      : null;
    const by = await prisma.user.findUnique({ where: { email: a.byEmail } });
    await prisma.activity.create({
      data: {
        clientId: client.id,
        projectId: project?.id ?? null,
        type: a.type,
        summary: a.summary,
        createdById: by?.id ?? null,
      },
    });
    console.log(`seeded activity (${a.type}) for ${a.client}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
