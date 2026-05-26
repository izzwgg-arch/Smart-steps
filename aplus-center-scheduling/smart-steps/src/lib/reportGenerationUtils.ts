/**
 * Helpers for auto-generating clinical report section content.
 * Server-side only — no "use client" directive.
 * All HTML produced here must pass through sanitizeHtml() before being stored.
 *
 * Behavior: builders REPLACE section content (Option B1).
 * Passthrough sections receive only placeholder substitution.
 */

import { escapeHtml, formatDate } from "./sanitizeHtml";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssessmentType = "initial" | "reassessment";

export interface TrialStats {
  correct: number;
  total: number;
}

export interface ReportClient {
  id: string;
  name: string;
  dob: Date;
  address?: string | null;
  diagnosis: string[];
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  school?: string | null;
  insuranceId?: string | null;
  intakeNotes?: string | null;
}

export interface ReportBcba {
  name: string;
  email: string;
  phone?: string | null;
  credentials?: string | null;
  role: string;
}

/** @deprecated Use ReportBcba. Kept for backward compatibility. */
export type ReportProvider = ReportBcba;

export interface ServicePeriod {
  start?: string;
  end?: string;
}

export interface ReportProgram {
  id: string;
  name: string;
  domain: string;
}

export interface ReportTarget {
  id: string;
  definition: string;
  phase: string;
  targetType: string;
  baseline?: string | null;
  dateMastered?: Date | null;
  notes?: string | null;
  createdAt?: Date | string | null;
}

export interface ReportParentGoal {
  id: string;
  title: string;
  description?: string | null;
  domain?: string | null;
  status: string;
  programId?: string | null;
  notes?: string | null;
  createdAt?: Date | string | null;
  program?: { id: string; name: string; domain: string } | null;
  targets: ReportTarget[];
}

// ── Section-type detection ────────────────────────────────────────────────────

export type SectionType =
  | { kind: "provider_info" }
  | { kind: "biopsychosocial" }
  | { kind: "why_aba" }
  | { kind: "category_goals"; keywords: string[] }
  | { kind: "mastered_goals" }
  | { kind: "current_goals" }
  | { kind: "parent_goals" }
  | { kind: "new_goals" }
  | { kind: "passthrough" };

/**
 * Maps a section title to a structured type that drives auto-population.
 * Keyword-based, case-insensitive. mastered_goals checked before current_goals.
 */
export function detectSectionType(title: string): SectionType {
  const t = title.toLowerCase();

  if (/service\s+period|provider\s+info/.test(t))
    return { kind: "provider_info" };

  if (/biopsychosocial|biophysical/.test(t))
    return { kind: "biopsychosocial" };

  if (/why\s+(aba|services?\s+(are\s+)?needed)/.test(t))
    return { kind: "why_aba" };

  if (/mastered\s+goals?/.test(t))
    return { kind: "mastered_goals" };

  if (/parent\s+goals?/.test(t))
    return { kind: "parent_goals" };

  if (/new\s+goals?|upcoming\s+goals?/.test(t))
    return { kind: "new_goals" };

  if (/current\s+goals?|goals?\s+and\s+objectives|skill\s+acquisition/.test(t) && !/mastered/.test(t))
    return { kind: "current_goals" };

  if (/language|communication/.test(t))
    return { kind: "category_goals", keywords: ["language", "communication"] };

  if (/social/.test(t))
    return { kind: "category_goals", keywords: ["social", "emotional"] };

  if (/adaptive|daily\s+living|self.care/.test(t))
    return { kind: "category_goals", keywords: ["adaptive", "daily living", "self-care", "self care"] };

  if (/challenging\s+behav|behavior\s+reduc/.test(t))
    return { kind: "category_goals", keywords: ["behavior", "challenging", "reduction"] };

  if (/executive\s+function/.test(t))
    return { kind: "category_goals", keywords: ["executive"] };

  if (/fine\s+motor/.test(t))
    return { kind: "category_goals", keywords: ["fine motor", "motor"] };

  if (/gross\s+motor/.test(t))
    return { kind: "category_goals", keywords: ["gross motor"] };

  if (/academic|pre.academic/.test(t))
    return { kind: "category_goals", keywords: ["academic"] };

  if (/vocational/.test(t))
    return { kind: "category_goals", keywords: ["vocational"] };

  if (/manding|requesting/.test(t))
    return { kind: "category_goals", keywords: ["manding", "requesting"] };

  if (/tacting|labeling/.test(t))
    return { kind: "category_goals", keywords: ["tacting", "labeling"] };

  if (/intraverbal/.test(t))
    return { kind: "category_goals", keywords: ["intraverbal"] };

  return { kind: "passthrough" };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function computeAge(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function phaseLabel(phase: string): string {
  switch ((phase ?? "").toUpperCase()) {
    case "NEW":            return "New";
    case "ACQUISITION":    return "In Treatment";
    case "BASELINE":       return "Baseline";
    case "MASTERED":       return "Mastered";
    case "MAINTENANCE":    return "Maintenance";
    case "GENERALIZATION": return "Generalization";
    default:               return phase;
  }
}

/**
 * Computes current performance level from recent trial batch.
 * Returns percentage string like "78%" or "—" when no data.
 */
export function computeCurrentLevel(
  targetId: string,
  trialStats: Map<string, TrialStats>,
): string {
  const s = trialStats.get(targetId);
  if (!s || s.total === 0) return "—";
  return `${Math.round((s.correct / s.total) * 100)}%`;
}

/**
 * Computes progress percentage for table display.
 * Returns "X% (N trials)" or "—".
 */
export function computeProgressPct(
  targetId: string,
  trialStats: Map<string, TrialStats>,
): string {
  const s = trialStats.get(targetId);
  if (!s || s.total === 0) return "—";
  const pct = Math.round((s.correct / s.total) * 100);
  return `${pct}% (${s.total} trial${s.total !== 1 ? "s" : ""})`;
}

// ── Paragraph generator ───────────────────────────────────────────────────────

/**
 * Generates a written clinical paragraph for a given category domain.
 * Initial assessment: current + future focus only.
 * Reassessment: includes mastery progress.
 */
function buildCategoryParagraph(
  clientName: string,
  categoryName: string,
  goals: ReportParentGoal[],
  assessmentType: AssessmentType,
): string {
  const allTargets  = goals.flatMap((g) => g.targets);
  const activeTs    = allTargets.filter((t) => ["ACQUISITION", "BASELINE"].includes(t.phase));
  const newTs       = allTargets.filter((t) => t.phase === "NEW");
  const masteredTs  = allTargets.filter((t) => t.phase === "MASTERED");
  const maintTs     = allTargets.filter((t) => ["MAINTENANCE", "GENERALIZATION"].includes(t.phase));

  if (allTargets.length === 0) {
    return `<p>No goals have been identified in the ${escapeHtml(categoryName)} domain at this time.</p>`;
  }

  const parts: string[] = [];

  if (assessmentType === "initial") {
    if (activeTs.length > 0) {
      const names = activeTs.slice(0, 3).map((t) => `<em>${escapeHtml(t.definition)}</em>`).join("; ");
      parts.push(
        `${escapeHtml(clientName)} is currently working on ${activeTs.length} objective${activeTs.length !== 1 ? "s" : ""} in the ${escapeHtml(categoryName)} domain, including: ${names}${activeTs.length > 3 ? ", and others" : ""}.`,
      );
    } else {
      parts.push(`${escapeHtml(categoryName)} goals have been identified for ${escapeHtml(clientName)}.`);
    }

    if (newTs.length > 0) {
      const newNames = newTs.slice(0, 2).map((t) => `<em>${escapeHtml(t.definition)}</em>`).join("; ");
      parts.push(
        `Newly introduced objectives include: ${newNames}${newTs.length > 2 ? ", among others" : ""}.`,
      );
    }

    parts.push(
      `ABA intervention in this domain will target skill acquisition, functional use, and generalization as clinically indicated.`,
    );
  } else {
    // Reassessment
    if (masteredTs.length > 0) {
      const mastNames = masteredTs.slice(0, 2).map((t) => `<em>${escapeHtml(t.definition)}</em>`).join("; ");
      parts.push(
        `${escapeHtml(clientName)} has demonstrated mastery of ${masteredTs.length} objective${masteredTs.length !== 1 ? "s" : ""} in the ${escapeHtml(categoryName)} domain since the previous assessment period, including: ${mastNames}${masteredTs.length > 2 ? ", among others" : ""}.`,
      );
    } else {
      parts.push(
        `${escapeHtml(clientName)} continues to make progress in the ${escapeHtml(categoryName)} domain.`,
      );
    }

    if (activeTs.length > 0) {
      const names = activeTs.slice(0, 3).map((t) => `<em>${escapeHtml(t.definition)}</em>`).join("; ");
      parts.push(`Goals currently in treatment include: ${names}${activeTs.length > 3 ? ", and others" : ""}.`);
    }

    if (maintTs.length > 0) {
      parts.push(
        `${maintTs.length} objective${maintTs.length !== 1 ? "s are" : " is"} currently in maintenance or generalization.`,
      );
    }

    if (newTs.length > 0) {
      const newNames = newTs.slice(0, 2).map((t) => `<em>${escapeHtml(t.definition)}</em>`).join("; ");
      parts.push(
        `Newly introduced objectives include: ${newNames}${newTs.length > 2 ? ", among others" : ""}.`,
      );
    }

    parts.push(
      `Continued treatment will address skill maintenance, generalization across environments, and introduction of new objectives as clinically appropriate.`,
    );
  }

  return `<p>${parts.join(" ")}</p>`;
}

// ── HTML builders ─────────────────────────────────────────────────────────────

/**
 * Service Period / Provider Information section.
 * Replaces template content entirely. Uses BCBA data from selector.
 */
export function buildProviderInfoHtml(
  client: ReportClient,
  provider: ReportBcba,
  servicePeriod: ServicePeriod,
  generationDate: string,
): string {
  const age = computeAge(client.dob);

  const rows: [string, string][] = [
    ["Client Name",          escapeHtml(client.name)],
    ["Date of Birth",        `${formatDate(client.dob)} (Age ${age})`],
    ["Diagnosis",            client.diagnosis.length ? escapeHtml(client.diagnosis.join(", ")) : "[Diagnosis]"],
    ["Insurance ID",         client.insuranceId ? escapeHtml(client.insuranceId) : "[Insurance ID]"],
    ["Address",              client.address ? escapeHtml(client.address) : "[Address]"],
    ["School / Program",     client.school ? escapeHtml(client.school) : "[School / Program]"],
    ["Service Period Start", servicePeriod.start ? escapeHtml(servicePeriod.start) : "[Service Period Start]"],
    ["Service Period End",   servicePeriod.end ? escapeHtml(servicePeriod.end) : "[Service Period End]"],
    ["Assessment Date",      escapeHtml(generationDate)],
    ["BCBA Name",            escapeHtml(provider.name)],
    ["BCBA Credentials",     provider.credentials ? escapeHtml(provider.credentials) : "[BCBA Credentials]"],
    ["BCBA Email",           escapeHtml(provider.email)],
    ["BCBA Phone",           provider.phone ? escapeHtml(provider.phone) : "[BCBA Phone]"],
  ];

  if (client.guardianName)  rows.push(["Guardian / Parent", escapeHtml(client.guardianName)]);
  if (client.guardianPhone) rows.push(["Guardian Phone",    escapeHtml(client.guardianPhone)]);
  if (client.guardianEmail) rows.push(["Guardian Email",    escapeHtml(client.guardianEmail)]);

  const tableRows = rows
    .map(([label, value]) => `<tr><td><strong>${label}</strong></td><td>${value}</td></tr>`)
    .join("\n");

  return ["<table><tbody>", tableRows, "</tbody></table>"].join("\n");
}

/**
 * Biopsychosocial Information section.
 * Replaces template content with a narrative paragraph + clinical notes.
 */
export function buildBiopsychosocialHtml(
  client: ReportClient,
  generationDate: string,
): string {
  const age      = computeAge(client.dob);
  const diagText = client.diagnosis.length
    ? `a diagnosis of <strong>${escapeHtml(client.diagnosis.join(", "))}</strong>`
    : "[insert diagnosis / clinical presentation]";

  const parts: string[] = [
    `<p><strong>${escapeHtml(client.name)}</strong> is a ${age}-year-old individual with ${diagText}. Assessment date: ${escapeHtml(generationDate)}.</p>`,
  ];

  if (client.school) {
    parts.push(`<p>${escapeHtml(client.name)} attends <strong>${escapeHtml(client.school)}</strong>.</p>`);
  }

  const guardianParts: string[] = [];
  if (client.guardianName)  guardianParts.push(escapeHtml(client.guardianName));
  if (client.guardianPhone) guardianParts.push(escapeHtml(client.guardianPhone));
  if (client.guardianEmail) guardianParts.push(escapeHtml(client.guardianEmail));
  if (guardianParts.length) {
    parts.push(`<p><strong>Guardian / Parent Contact:</strong> ${guardianParts.join(" · ")}</p>`);
  }

  if (client.intakeNotes) {
    parts.push(`<p><strong>Clinical Notes:</strong> ${escapeHtml(client.intakeNotes)}</p>`);
  }

  parts.push(
    `<p>[Continue with biopsychosocial history, family background, developmental history, ` +
    `relevant medical and psychiatric history, and prior treatment history.]</p>`,
  );

  return parts.join("\n");
}

/**
 * Why ABA Services Are Needed section.
 * Replaces template with a brief rationale paragraph.
 */
export function buildWhyAbaHtml(
  client: ReportClient,
  generationDate: string,
): string {
  const age      = computeAge(client.dob);
  const diagText = client.diagnosis.length
    ? escapeHtml(client.diagnosis.join(", "))
    : "[diagnosis]";

  return [
    `<p><strong>${escapeHtml(client.name)}</strong>, age ${age}, presents with ${diagText}. `,
    `Applied Behavior Analysis (ABA) services are recommended to address identified skill deficits `,
    `and behavioral needs as documented in this comprehensive assessment (${escapeHtml(generationDate)}).</p>`,
    `<p>[Describe specific functional impairments, skill deficits, behavioral challenges, `,
    `and how ABA services will address these individualized needs.]</p>`,
  ].join("");
}

/**
 * Category-specific goals section (Language, Social, Adaptive, etc.).
 * Structure: written paragraph FIRST, then goals table, then mastered table (reassessment).
 * Returns null if no matching goals exist.
 */
export function buildCategoryGoalsHtml(
  programs: ReportProgram[],
  allGoals: ReportParentGoal[],
  categoryKeywords: string[],
  generationDate: string,
  trialStats: Map<string, TrialStats> = new Map(),
  assessmentType: AssessmentType = "reassessment",
  clientName: string = "",
): string | null {
  const kwLower = categoryKeywords.map((k) => k.toLowerCase());
  const categoryName = categoryKeywords[0]
    ? categoryKeywords[0].charAt(0).toUpperCase() + categoryKeywords[0].slice(1)
    : "this domain";

  const matchingProgramIds = new Set<string>(
    programs
      .filter((p) =>
        kwLower.some(
          (kw) => p.name.toLowerCase().includes(kw) || p.domain.toLowerCase().includes(kw),
        ),
      )
      .map((p) => p.id),
  );

  const matchingGoals = allGoals.filter(
    (g) =>
      (g.programId && matchingProgramIds.has(g.programId)) ||
      kwLower.some((kw) => (g.domain ?? "").toLowerCase().includes(kw)),
  );

  if (matchingGoals.length === 0) return null;

  const paragraph = buildCategoryParagraph(clientName, categoryName, matchingGoals, assessmentType);

  // Active + future goals table
  const activeGoals = matchingGoals.filter(
    (g) => g.status !== "MASTERED" && g.status !== "ARCHIVED",
  );
  const activeRows  = _buildActiveGoalsRows(activeGoals, trialStats);

  const parts: string[] = [paragraph];

  if (activeRows.length > 0) {
    parts.push(
      `<table>`,
      `<thead><tr>`,
      `<th>Behavior / Goal</th><th>Objective</th><th>Start Date</th>`,
      `<th>Baseline Level</th><th>Current Level</th>`,
      `<th>Progress %</th><th>Status</th><th>Date Opened</th>`,
      `</tr></thead>`,
      `<tbody>`,
      ...activeRows,
      `</tbody></table>`,
    );
  }

  // Mastered goals table — reassessment only
  if (assessmentType === "reassessment") {
    const masteredRows = _buildMasteredGoalsRows(matchingGoals);
    if (masteredRows.length > 0) {
      parts.push(
        `<h3>Mastered Objectives</h3>`,
        `<table>`,
        `<thead><tr><th>Behavior / Goal</th><th>Objective</th><th>Date Mastered</th></tr></thead>`,
        `<tbody>`,
        ...masteredRows,
        `</tbody></table>`,
      );
    }
  }

  return parts.join("\n");
}

// ── Shared row helpers ────────────────────────────────────────────────────────

function _buildActiveGoalsRows(
  goals: ReportParentGoal[],
  trialStats: Map<string, TrialStats>,
): string[] {
  return goals.flatMap((g) => {
    const goalOpenDate = g.createdAt ? formatDate(g.createdAt instanceof Date ? g.createdAt : new Date(g.createdAt)) : "—";

    if (g.targets.length === 0) {
      return [
        `<tr>` +
        `<td>${escapeHtml(g.title)}</td>` +
        `<td colspan="7"><em>No targets defined</em></td>` +
        `</tr>`,
      ];
    }

    return g.targets
      .filter((t) => t.phase !== "MASTERED")
      .map((t, idx) => {
        const startDate    = t.createdAt ? formatDate(t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)) : "—";
        const currentLevel = computeCurrentLevel(t.id, trialStats);
        const progressPct  = computeProgressPct(t.id, trialStats);
        return (
          `<tr>` +
          `<td>${idx === 0 ? escapeHtml(g.title) : ""}</td>` +
          `<td>${escapeHtml(t.definition)}</td>` +
          `<td>${startDate}</td>` +
          `<td>${t.baseline ? escapeHtml(t.baseline) : "—"}</td>` +
          `<td>${currentLevel}</td>` +
          `<td>${progressPct}</td>` +
          `<td>${phaseLabel(t.phase)}</td>` +
          `<td>${goalOpenDate}</td>` +
          `</tr>`
        );
      });
  });
}

function _buildMasteredGoalsRows(goals: ReportParentGoal[]): string[] {
  return goals.flatMap((g) =>
    g.targets
      .filter((t) => t.phase === "MASTERED")
      .map((t) =>
        `<tr>` +
        `<td>${escapeHtml(g.title)}</td>` +
        `<td>${escapeHtml(t.definition)}</td>` +
        `<td>${t.dateMastered ? formatDate(t.dateMastered) : "—"}</td>` +
        `</tr>`,
      ),
  );
}

// ── Full-report section builders ──────────────────────────────────────────────

/**
 * Mastered Goals and Objectives section.
 * For initial assessments: shows a "no mastered goals" note.
 * For reassessments: shows all targets mastered in the past 6 months.
 */
export function buildMasteredGoalsHtml(
  allGoals: ReportParentGoal[],
  programs: ReportProgram[],
  generationDate: string,
  assessmentType: AssessmentType = "reassessment",
): string {
  if (assessmentType === "initial") {
    return [
      `<p><em>This is an initial assessment. No previously mastered goals to report.</em></p>`,
      `<p><strong>Assessment Date:</strong> ${escapeHtml(generationDate)}</p>`,
    ].join("\n");
  }

  const programMap = new Map(programs.map((p) => [p.id, p.name]));

  const masteredGoals = allGoals.filter((g) =>
    g.targets.some((t) => t.phase === "MASTERED"),
  );

  if (masteredGoals.length === 0) {
    return `<p><em>No goals were mastered in the reporting period.</em></p>`;
  }

  const rows: string[] = [];
  for (const g of masteredGoals) {
    const category = g.programId
      ? (programMap.get(g.programId) ?? g.domain ?? "—")
      : (g.domain ?? "—");
    for (const t of g.targets.filter((t) => t.phase === "MASTERED")) {
      rows.push(
        `<tr>` +
        `<td>${escapeHtml(g.title)}</td>` +
        `<td>${escapeHtml(t.definition)}</td>` +
        `<td>${t.dateMastered ? formatDate(t.dateMastered) : "—"}</td>` +
        `</tr>`,
      );
    }
  }

  const totalMastered = rows.length;

  return [
    `<p><strong>${totalMastered} objective${totalMastered !== 1 ? "s" : ""} mastered in the reporting period.</strong></p>`,
    `<table>`,
    `<thead><tr><th>Behavior / Goal</th><th>Objective</th><th>Date Mastered</th></tr></thead>`,
    `<tbody>`,
    ...rows,
    `</tbody></table>`,
  ].join("\n");
}

/**
 * Current Goals and Objectives / Skill Acquisition section.
 * 8-column table for active + future goals, with trial-based current level.
 */
export function buildCurrentGoalsHtml(
  allGoals: ReportParentGoal[],
  programs: ReportProgram[],
  generationDate: string,
  trialStats: Map<string, TrialStats> = new Map(),
  assessmentType: AssessmentType = "reassessment",
): string {
  const activeGoals = allGoals.filter(
    (g) => g.status !== "ARCHIVED",
  );

  if (activeGoals.length === 0) {
    return `<p><em>No active goals or targets were found for this client as of ${escapeHtml(generationDate)}.</em></p>`;
  }

  const rows = _buildActiveGoalsRows(activeGoals, trialStats);
  const totalTargets = activeGoals.reduce(
    (n, g) => n + g.targets.filter((t) => t.phase !== "MASTERED").length,
    0,
  );

  return [
    `<p><strong>${activeGoals.length} skill area${activeGoals.length !== 1 ? "s" : ""} ` +
    `with ${totalTargets} active target${totalTargets !== 1 ? "s" : ""}.</strong></p>`,
    `<table>`,
    `<thead><tr>`,
    `<th>Behavior / Goal</th><th>Objective</th><th>Start Date</th>`,
    `<th>Baseline Level</th><th>Current Level</th>`,
    `<th>Progress %</th><th>Status</th><th>Date Opened</th>`,
    `</tr></thead>`,
    `<tbody>`,
    ...rows,
    `</tbody></table>`,
  ].join("\n");
}

/**
 * Parent Goals section.
 * Shows high-level skill areas with introduction date, baseline, current level,
 * notes/comments, and a "Carrying Over?" column for manual entry.
 */
export function buildParentGoalsHtml(
  allGoals: ReportParentGoal[],
  programs: ReportProgram[],
  generationDate: string,
  trialStats: Map<string, TrialStats> = new Map(),
): string {
  const programMap = new Map(programs.map((p) => [p.id, p.name]));

  const relevantGoals = allGoals.filter((g) => g.status !== "ARCHIVED");

  if (relevantGoals.length === 0) {
    return `<p><em>No parent goals found as of ${escapeHtml(generationDate)}.</em></p>`;
  }

  const rows = relevantGoals.map((g) => {
    const introDate     = g.createdAt ? formatDate(g.createdAt instanceof Date ? g.createdAt : new Date(g.createdAt)) : "—";
    const firstTarget   = g.targets[0];
    const baseline      = firstTarget?.baseline ?? "—";
    const currentLevel  = firstTarget ? computeCurrentLevel(firstTarget.id, trialStats) : "—";
    const objective     = firstTarget ? escapeHtml(firstTarget.definition) : (g.description ? escapeHtml(g.description) : "—");

    return (
      `<tr>` +
      `<td>${escapeHtml(g.title)}</td>` +
      `<td>${objective}</td>` +
      `<td>${introDate}</td>` +
      `<td>${baseline !== "—" ? escapeHtml(baseline) : "—"}</td>` +
      `<td>${currentLevel}</td>` +
      `<td>${g.notes ? escapeHtml(g.notes) : "—"}</td>` +
      `<td></td>` +
      `</tr>`
    );
  });

  return [
    `<table>`,
    `<thead><tr>`,
    `<th>Behavior</th><th>Objective</th><th>Introduction Date</th>`,
    `<th>Baseline Level</th><th>Current Level</th>`,
    `<th>Comments</th><th>Carrying Over?</th>`,
    `</tr></thead>`,
    `<tbody>`,
    ...rows,
    `</tbody></table>`,
  ].join("\n");
}

/**
 * New Goals section.
 * Shows only targets with phase = "NEW" — targets recently introduced but not yet in active treatment.
 */
export function buildNewGoalsHtml(
  allGoals: ReportParentGoal[],
  programs: ReportProgram[],
  generationDate: string,
): string {
  const programMap = new Map(programs.map((p) => [p.id, p.name]));

  const newRows: string[] = [];
  for (const g of allGoals) {
    const category = g.programId
      ? (programMap.get(g.programId) ?? g.domain ?? "—")
      : (g.domain ?? "—");
    for (const t of g.targets.filter((t) => t.phase === "NEW")) {
      const startDate = t.createdAt ? formatDate(t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)) : "—";
      newRows.push(
        `<tr>` +
        `<td>${escapeHtml(category)}</td>` +
        `<td>${escapeHtml(g.title)}</td>` +
        `<td>${escapeHtml(t.definition)}</td>` +
        `<td>${t.baseline ? escapeHtml(t.baseline) : "—"}</td>` +
        `<td>${startDate}</td>` +
        `</tr>`,
      );
    }
  }

  if (newRows.length === 0) {
    return `<p><em>No newly introduced goals at this time (${escapeHtml(generationDate)}).</em></p>`;
  }

  return [
    `<p><strong>${newRows.length} newly introduced objective${newRows.length !== 1 ? "s" : ""}.</strong></p>`,
    `<table>`,
    `<thead><tr>`,
    `<th>Category</th><th>Behavior / Goal</th><th>Objective</th>`,
    `<th>Baseline</th><th>Introduced</th>`,
    `</tr></thead>`,
    `<tbody>`,
    ...newRows,
    `</tbody></table>`,
  ].join("\n");
}
