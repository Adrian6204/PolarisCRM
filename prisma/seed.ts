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
} from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
