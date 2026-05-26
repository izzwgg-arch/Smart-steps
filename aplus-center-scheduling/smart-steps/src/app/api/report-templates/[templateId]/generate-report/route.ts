import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { replacePlaceholders, replaceBracketPlaceholders, sanitizeHtml, formatDate } from "@/lib/sanitizeHtml";
import {
  detectSectionType,
  buildProviderInfoHtml,
  buildBiopsychosocialHtml,
  buildWhyAbaHtml,
  buildCategoryGoalsHtml,
  buildMasteredGoalsHtml,
  buildCurrentGoalsHtml,
  buildParentGoalsHtml,
  buildNewGoalsHtml,
  computeAge,
  computeCurrentLevel,
  computeProgressPct,
  type ReportClient,
  type ReportBcba,
  type ServicePeriod,
  type AssessmentType,
  type TrialStats,
} from "@/lib/reportGenerationUtils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { templateId } = await params;

  const body = await req.json() as {
    clientId?: string;
    title?: string;
    servicePeriodStart?: string;
    servicePeriodEnd?: string;
    assessmentType?: "initial" | "reassessment";
    bcbaUserId?: string;
  };
  const {
    clientId,
    title,
    servicePeriodStart,
    servicePeriodEnd,
    assessmentType = "reassessment",
    bcbaUserId,
  } = body;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Parallel fetch: template, client, programs, parent-goals + targets, optional BCBA user
  const [template, client, programs, parentGoals, bcbaUser] = await Promise.all([
    prisma.reportTemplate.findUnique({
      where: { id: templateId },
      include: { sections: { orderBy: { order: "asc" } } },
    }),
    prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true, name: true, dob: true, address: true,
        diagnosis: true, guardianName: true, guardianEmail: true,
        guardianPhone: true, school: true, insuranceId: true, intakeNotes: true,
      },
    }),
    prisma.program.findMany({
      where: { clientId, isActive: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.parentGoal.findMany({
      where: { clientId, status: { not: "ARCHIVED" } },
      include: {
        program: { select: { id: true, name: true, domain: true } },
        targets: {
          where: {
            isActive: true,
            OR: [
              { phase: { in: ["NEW", "ACQUISITION", "BASELINE", "MAINTENANCE", "GENERALIZATION"] } },
              { phase: "MASTERED", dateMastered: { gte: sixMonthsAgo } },
            ],
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true, definition: true, phase: true, targetType: true,
            baseline: true, dateMastered: true, notes: true, createdAt: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    // Fetch selected BCBA or fall back to null (session user used below)
    bcbaUserId
      ? prisma.user.findUnique({
          where: { id: bcbaUserId },
          select: { id: true, name: true, email: true, role: true, phone: true, credentials: true },
        })
      : Promise.resolve(null),
  ]);

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!client)   return NextResponse.json({ error: "Client not found" },   { status: 404 });

  // ── Batch trial query for current-level calculation ────────────────────────
  // Bounded to last 30 days, max 500 trials for performance safety.
  const allTargetIds = parentGoals.flatMap((g) => g.targets.map((t) => t.id));
  const trialStats   = new Map<string, TrialStats>();

  if (allTargetIds.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTrials  = await prisma.trial.findMany({
      where: {
        targetId: { in: allTargetIds },
        deletedAt: null,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { targetId: true, result: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    for (const trial of recentTrials) {
      const s = trialStats.get(trial.targetId) ?? { correct: 0, total: 0 };
      s.total++;
      if (["CORRECT", "INDEPENDENT"].includes(trial.result.toUpperCase())) s.correct++;
      trialStats.set(trial.targetId, s);
    }
  }

  // ── BCBA / provider info ───────────────────────────────────────────────────
  // Use selected BCBA if provided; fall back to session user only if no bcbaUserId given.
  const sessionUser = session.user as { name?: string | null; email?: string | null; role?: string };

  let providerName: string;
  let providerEmail: string;
  let providerRole: string;
  let providerPhone: string | null = null;
  let providerCredentials: string | null = null;

  if (bcbaUser) {
    providerName        = bcbaUser.name ?? bcbaUser.email ?? "";
    providerEmail       = bcbaUser.email ?? "";
    providerRole        = bcbaUser.role ?? "BCBA";
    providerPhone       = bcbaUser.phone ?? null;
    providerCredentials = bcbaUser.credentials ?? null;
  } else if (!bcbaUserId) {
    // No BCBA selected — use session user as fallback
    providerName  = sessionUser.name  ?? sessionUser.email ?? "";
    providerEmail = sessionUser.email ?? "";
    providerRole  = sessionUser.role  ?? "";
  } else {
    // bcbaUserId was given but user not found
    providerName  = "[BCBA Name]";
    providerEmail = "[BCBA Email]";
    providerRole  = "BCBA";
  }

  const generationDate = formatDate(new Date());
  const age            = computeAge(client.dob);

  // ── Placeholder map ({{key}} and (bracket) forms) ─────────────────────────
  const values: Record<string, string> = {
    client_name:          client.name,
    dob:                  formatDate(client.dob),
    address:              client.address ?? "",
    assessment_date:      generationDate,
    provider_name:        providerName,
    age:                  String(age),
    diagnosis:            client.diagnosis.join(", "),
    insurance_id:         client.insuranceId ?? "",
    guardian_name:        client.guardianName ?? "",
    guardian_phone:       client.guardianPhone ?? "",
    guardian_email:       client.guardianEmail ?? "",
    school:               client.school ?? "",
    intake_notes:         client.intakeNotes ?? "",
    provider_email:       providerEmail,
    provider_role:        providerRole,
    provider_phone:       providerPhone ?? "",
    provider_credentials: providerCredentials ?? "",
    service_period_start: servicePeriodStart ?? "",
    service_period_end:   servicePeriodEnd   ?? "",
  };

  const reportClient: ReportClient = { ...client };
  const provider: ReportBcba = {
    name: providerName, email: providerEmail, role: providerRole,
    phone: providerPhone, credentials: providerCredentials,
  };
  const servicePeriod: ServicePeriod = { start: servicePeriodStart, end: servicePeriodEnd };

  // ── Build section content (REPLACE behavior — Option B1) ──────────────────
  const reportSections = template.sections.map((s) => {
    const sectionType = detectSectionType(s.title);
    let generatedHtml: string | null = null;

    switch (sectionType.kind) {
      case "provider_info":
        generatedHtml = buildProviderInfoHtml(reportClient, provider, servicePeriod, generationDate);
        break;
      case "biopsychosocial":
        generatedHtml = buildBiopsychosocialHtml(reportClient, generationDate);
        break;
      case "why_aba":
        generatedHtml = buildWhyAbaHtml(reportClient, generationDate);
        break;
      case "category_goals":
        generatedHtml = buildCategoryGoalsHtml(
          programs, parentGoals, sectionType.keywords,
          generationDate, trialStats, assessmentType, client.name,
        );
        break;
      case "mastered_goals":
        generatedHtml = buildMasteredGoalsHtml(parentGoals, programs, generationDate, assessmentType);
        break;
      case "current_goals":
        generatedHtml = buildCurrentGoalsHtml(parentGoals, programs, generationDate, trialStats, assessmentType);
        break;
      case "parent_goals":
        generatedHtml = buildParentGoalsHtml(parentGoals, programs, generationDate, trialStats);
        break;
      case "new_goals":
        generatedHtml = buildNewGoalsHtml(parentGoals, programs, generationDate);
        break;
      // passthrough: placeholder substitution only
    }

    let finalContent: string;
    if (generatedHtml !== null) {
      // REPLACE: discard template instructional text, use generated content
      finalContent = sanitizeHtml(generatedHtml);
    } else {
      // PASSTHROUGH: apply {{key}} and (bracket) placeholder substitution on template content
      const base = s.content ?? "";
      const withCurly   = replacePlaceholders(base, values);
      const withBracket = replaceBracketPlaceholders(withCurly, values);
      finalContent = sanitizeHtml(withBracket);
    }

    return { title: s.title, order: s.order, content: finalContent };
  });

  const report = await prisma.clientReport.create({
    data: {
      clientId,
      templateId: template.id,
      title: title?.trim() || template.name,
      status: "DRAFT",
      sections: { create: reportSections },
    },
    include: {
      sections: { orderBy: { order: "asc" } },
      client:   { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(report, { status: 201 });
}
