import { randomBytes } from "node:crypto";
import prisma from "../src/index";
import {
  createUserWithPassword,
  daysAgo,
  getRiskTier,
  toDepartmentNameKey,
  upsertDashboardStatsForUser,
} from "./helpers";
import {
  buildScanDates,
  DEMO_DEPARTMENTS,
  DEMO_ORG,
  DEMO_PASSWORD,
  DEMO_PENDING_INVITE,
  DEMO_PERSONAL_USER,
  DEMO_USERS,
} from "./fixtures";

const DEMO_EMAIL_SUFFIXES = ["@acme.demo", "@phishguard.demo"] as const;

async function deleteDemoData() {
  const demoOrg = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG.slug },
    select: { id: true },
  });

  if (demoOrg) {
    console.log(`[seed:demo] Removing existing demo organization: ${DEMO_ORG.slug}`);
    await prisma.organization.delete({ where: { id: demoOrg.id } });
  }

  const deletedUsers = await prisma.user.deleteMany({
    where: {
      OR: DEMO_EMAIL_SUFFIXES.map((suffix) => ({
        email: { endsWith: suffix },
      })),
    },
  });

  if (deletedUsers.count > 0) {
    console.log(`[seed:demo] Removed ${deletedUsers.count} demo users`);
  }
}

async function ensureDemoOrganization(creatorId: string) {
  const existing = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG.slug },
  });

  if (existing) {
    return existing;
  }

  const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  return prisma.organization.create({
    data: {
      name: DEMO_ORG.name,
      nameNormalized: DEMO_ORG.name.toLowerCase(),
      slug: DEMO_ORG.slug,
      domain: DEMO_ORG.domain,
      createdById: creatorId,
      subscription: {
        create: {
          plan: "team_business",
          status: "active",
          maxMembers: 50,
          scansPerMonth: 25000,
          scansPerHourPerUser: 500,
          maxApiTokens: 20,
          currentPeriodEnd: periodEnd,
        },
      },
      organizationDepartments: {
        create: [
          { name: "Unassigned", nameNormalized: "unassigned" },
          ...DEMO_DEPARTMENTS.map((name) => ({
            name,
            nameNormalized: toDepartmentNameKey(name),
          })),
        ],
      },
    },
  });
}

export async function seedDemoData(adminUserId: string) {
  const enabled = process.env.SEED_DEMO !== "false";
  if (!enabled) {
    console.log("[seed:demo] Skipped (SEED_DEMO=false)");
    return;
  }

  const reset = process.env.DEMO_RESET === "true";
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG.slug },
    select: { id: true },
  });

  if (existingOrg && !reset) {
    console.log(`[seed:demo] Demo organization already exists: ${DEMO_ORG.slug}`);
    console.log("[seed:demo] Set DEMO_RESET=true to recreate demo data.");
    return;
  }

  if (reset || existingOrg) {
    await deleteDemoData();
  }

  console.log("[seed:demo] Creating demo organization and users...");

  const organization = await ensureDemoOrganization(adminUserId);
  const departments = await prisma.organizationDepartment.findMany({
    where: { organizationId: organization.id },
  });
  const departmentByName = new Map(
    departments.map((department) => [department.name, department.id])
  );

  const orgAdminFixture = DEMO_USERS.find((user) => user.role === "admin");
  if (!orgAdminFixture) {
    throw new Error("Demo fixtures must include an organization admin");
  }

  const orgAdmin = await createUserWithPassword({
    email: orgAdminFixture.email,
    password: process.env.DEMO_PASSWORD || DEMO_PASSWORD,
    name: orgAdminFixture.name,
    emailVerified: true,
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: orgAdmin.id,
      role: "admin",
      departmentId: departmentByName.get(orgAdminFixture.department) ?? null,
    },
  });

  const memberUsers = new Map<string, { id: string; email: string; name: string }>();
  memberUsers.set(orgAdminFixture.key, orgAdmin);

  for (const fixture of DEMO_USERS.filter((user) => user.key !== orgAdminFixture.key)) {
    const user = await createUserWithPassword({
      email: fixture.email,
      password: process.env.DEMO_PASSWORD || DEMO_PASSWORD,
      name: fixture.name,
      emailVerified: true,
    });

    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: fixture.role,
        departmentId: departmentByName.get(fixture.department) ?? null,
        joinedAt: daysAgo(60 + DEMO_USERS.indexOf(fixture) * 3),
      },
    });

    memberUsers.set(fixture.key, user);
  }

  console.log("[seed:demo] Creating phishing scans and dashboard stats...");

  for (const fixture of DEMO_USERS) {
    const user = memberUsers.get(fixture.key);
    if (!user) continue;

    const departmentId = departmentByName.get(fixture.department) ?? null;
    const scanDates = buildScanDates(fixture.scans);

    for (const scan of scanDates) {
      await prisma.scan.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          departmentId,
          url: scan.url ?? null,
          textContent: scan.textContent ?? null,
          textScore: scan.textScore,
          urlScore: scan.urlScore,
          overallScore: scan.overallScore,
          riskLevel: scan.riskLevel,
          isPhishing: scan.isPhishing,
          confidence: scan.confidence,
          detectedThreats: scan.detectedThreats,
          analysis: scan.analysis,
          source: scan.source,
          createdAt: scan.createdAt,
        },
      });
    }

    await upsertDashboardStatsForUser(user.id);
  }

  console.log("[seed:demo] Creating risk snapshots and training assignments...");

  const snapshotDate = daysAgo(0);
  snapshotDate.setHours(0, 0, 0, 0);

  for (const fixture of DEMO_USERS) {
    const user = memberUsers.get(fixture.key);
    if (!user) continue;

    const recentScans = await prisma.scan.findMany({
      where: {
        organizationId: organization.id,
        userId: user.id,
        isDeleted: false,
        createdAt: { gte: daysAgo(30) },
      },
    });

    if (recentScans.length === 0) continue;

    const riskyScans = recentScans.filter((scan) =>
      ["high", "critical", "medium"].includes(scan.riskLevel)
    ).length;
    const avgScore =
      recentScans.reduce((sum, scan) => sum + scan.overallScore, 0) / recentScans.length;
    const riskTier = getRiskTier(avgScore);
    const dominantAttackType =
      fixture.training?.attackType ||
      recentScans
        .flatMap((scan) => scan.detectedThreats)
        .find((threat) => threat.startsWith("attack_type:"))
        ?.replace("attack_type:", "") ||
      "Other";

    const snapshot = await prisma.memberRiskSnapshot.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        snapshotDate,
        windowDays: 30,
        totalScans: recentScans.length,
        riskyScans,
        avgScore,
        riskTier,
        dominantAttackType,
        recommendation:
          fixture.training?.recommendation ||
          `Monitorizare continuă pentru ${dominantAttackType}.`,
      },
    });

    if (fixture.training) {
      const dueAt =
        fixture.training.dueInDays !== undefined
          ? new Date(Date.now() + fixture.training.dueInDays * 24 * 60 * 60 * 1000)
          : null;
      const completedAt =
        fixture.training.completedDaysAgo !== undefined
          ? daysAgo(fixture.training.completedDaysAgo)
          : fixture.training.status === "completed"
            ? daysAgo(3)
            : null;

      await prisma.trainingAssignment.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          assignedById: orgAdmin.id,
          snapshotId: snapshot.id,
          source: fixture.training.source,
          status: fixture.training.status,
          attackType: fixture.training.attackType,
          recommendation: fixture.training.recommendation,
          note:
            fixture.training.status === "in_progress"
              ? "Utilizatorul a început modulul de training."
              : null,
          dueAt,
          completedAt,
          createdAt: daysAgo(fixture.training.completedDaysAgo ?? 14),
        },
      });
    }
  }

  console.log("[seed:demo] Creating personal (B2C) demo user...");

  const personalUser = await createUserWithPassword({
    email: DEMO_PERSONAL_USER.email,
    password: process.env.DEMO_PASSWORD || DEMO_PASSWORD,
    name: DEMO_PERSONAL_USER.name,
    emailVerified: true,
  });

  const personalPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.personalSubscription.upsert({
    where: { userId: personalUser.id },
    create: {
      userId: personalUser.id,
      plan: "personal_plus",
      status: "active",
      scansPerMonth: 1000,
      scansPerHour: 50,
      maxApiTokens: 3,
      currentPeriodEnd: personalPeriodEnd,
    },
    update: {
      plan: "personal_plus",
      status: "active",
      currentPeriodEnd: personalPeriodEnd,
    },
  });

  for (const scan of buildScanDates([...DEMO_PERSONAL_USER.scans])) {
    await prisma.scan.create({
      data: {
        userId: personalUser.id,
        url: scan.url ?? null,
        textContent: scan.textContent ?? null,
        textScore: scan.textScore,
        urlScore: scan.urlScore,
        overallScore: scan.overallScore,
        riskLevel: scan.riskLevel,
        isPhishing: scan.isPhishing,
        confidence: scan.confidence,
        detectedThreats: scan.detectedThreats,
        analysis: scan.analysis,
        source: scan.source,
        createdAt: scan.createdAt,
      },
    });
  }

  await upsertDashboardStatsForUser(personalUser.id);

  console.log("[seed:demo] Creating pending organization invite...");

  await prisma.organizationInvite.create({
    data: {
      organizationId: organization.id,
      email: DEMO_PENDING_INVITE.email,
      role: DEMO_PENDING_INVITE.role,
      token: randomBytes(24).toString("hex"),
      invitedById: orgAdmin.id,
      status: "sent",
      sendAttempts: 1,
      lastSentAt: daysAgo(1),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("[seed:demo] Demo data created successfully.");
  console.log("");
  console.log("=== Demo credentials (password for all: Demo@123456) ===");
  console.log(`Organization: ${DEMO_ORG.name} (@${DEMO_ORG.slug})`);
  console.log(`Org admin:    ${orgAdminFixture.email}`);
  console.log("High risk:    ion.marinescu@acme.demo, elena.stan@acme.demo");
  console.log("Training:     andrei.vasile@acme.demo (in progress), maria.georgescu@acme.demo (completed)");
  console.log(`Personal B2C: ${DEMO_PERSONAL_USER.email}`);
  console.log("");
  console.log("Pages to explore:");
  console.log(`  /org/${DEMO_ORG.slug}`);
  console.log(`  /org/${DEMO_ORG.slug}/members`);
  console.log(`  /org/${DEMO_ORG.slug}/members/<userId>`);
  console.log("  /dashboard (login as org admin or member)");
}
