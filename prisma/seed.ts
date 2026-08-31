/**
 * Local dev seed. Idempotent (upserts by unique keys) so it can be re-run.
 * Phase 0 seeds only the auth users — one per role — so you can log in and
 * exercise role-based access immediately. Feature fixtures (clients, projects)
 * are added to this script as those phases land.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

const USERS: Array<{ email: string; name: string; role: Role; password: string }> = [
  { email: "admin@polaris.dev", name: "Ada Admin", role: Role.admin, password: "password123" },
  { email: "lead@polaris.dev", name: "Leo Lead", role: Role.project_lead, password: "password123" },
  { email: "member@polaris.dev", name: "Mia Member", role: Role.team_member, password: "password123" },
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
