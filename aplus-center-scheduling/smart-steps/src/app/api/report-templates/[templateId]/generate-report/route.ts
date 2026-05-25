import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { replacePlaceholders, sanitizeHtml, formatDate } from "@/lib/sanitizeHtml";
import {
  detectSectionType,
  buildProviderInfoHtml,
  buildBiopsychosocialHtml,
  buildWhyAbaHtml,
  buildCategoryGoalsHtml,
  buildMasteredGoalsHtml,
  buildCurrentGoalsHtml,
  computeAge,
  type ReportClient,
  type ReportProvider,
  type ServicePeriod,
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
  };
  const { clientId, title, servicePeriodStart, servicePeriodEnd } = body;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Parallel fetch: template, full client, programs, parent-goals + targets
  const [template, client, programs, parentGoals] = await Promise.all([
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
              // Active phases — always included
              { phase: { in: ["NEW", "ACQUISITION", "BASELINE", "MAINTENANCE", "GENERALIZATION"] } },
              // Mastered within the past 6 months only
              { phase: "MASTERED", dateMastered: { gte: sixMonthsAgo } },
            ],
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!client)   return NextResponse.json({ error: "Client not found" },   { status: 404 });

  const generationDate = formatDate(new Date());
  const age = computeAge(client.dob);

  // ── Provider info from session ─────────────────────────────────────────────
  const sessionUser = session.user as { name?: string | null; email?: string | null; role?: string };
  const providerName  = sessionUser.name  ?? sessionUser.email ?? "";
  const providerEmail = sessionUser.email ?? "";
  const providerRole  = sessionUser.role  ?? "";

  // ── Expanded placeholder map ({{key}} syntax used in template HTML) ────────
  const values: Record<string, string> = {
    // Existing placeholders (preserved for backward-compatibility)
    client_name:          client.name,
    dob:                  formatDate(client.dob),
    address:              client.address ?? "",
    assessment_date:      generationDate,
    provider_name:        providerName,
    // New placeholders
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
    service_period_start: servicePeriodStart ?? "",
    service_period_end:   servicePeriodEnd   ?? "",
  };

  const reportClient: ReportClient = client;
  const provider: ReportProvider   = { name: providerName, email: providerEmail, role: providerRole };
  const servicePeriod: ServicePeriod = { start: servicePeriodStart, end: servicePeriodEnd };

  // ── Build section content ──────────────────────────────────────────────────
  const reportSections = template.sections.map((s) => {
    // 1. Apply placeholder substitution to the existing template content
    const baseContent = s.content
      ? sanitizeHtml(replacePlaceholders(s.content, values))
      : "";

    // 2. Determine if this section gets an auto-generated block prepended
    const sectionType = detectSectionType(s.title);
    let injectedHtml: string | null = null;

    switch (sectionType.kind) {
      case "provider_info":
        injectedHtml = buildProviderInfoHtml(reportClient, provider, servicePeriod, generationDate);
        break;
      case "biopsychosocial":
        injectedHtml = buildBiopsychosocialHtml(reportClient, generationDate);
        break;
      case "why_aba":
        injectedHtml = buildWhyAbaHtml(reportClient, generationDate);
        break;
      case "category_goals":
        injectedHtml = buildCategoryGoalsHtml(programs, parentGoals, sectionType.keywords, generationDate);
        break;
      case "mastered_goals":
        injectedHtml = buildMasteredGoalsHtml(parentGoals, programs, generationDate);
        break;
      case "current_goals":
        injectedHtml = buildCurrentGoalsHtml(parentGoals, programs, generationDate);
        break;
      // passthrough: placeholder substitution only — no injection
    }

    // 3. Prepend auto-generated block; preserve existing template content below it
    const finalContent = injectedHtml
      ? sanitizeHtml(injectedHtml) + (baseContent ? "\n" + baseContent : "")
      : baseContent;

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
