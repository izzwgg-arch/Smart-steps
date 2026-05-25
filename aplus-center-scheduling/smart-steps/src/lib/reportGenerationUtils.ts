/**
 * Helpers for auto-generating clinical report section content.
 * Server-side only — no "use client" directive.
 * All HTML produced here must pass through sanitizeHtml() before being stored.
 */

import { escapeHtml, formatDate } from "./sanitizeHtml";

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface ReportProvider {
  name: string;
  email: string;
  role: string;
}

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
}

export interface ReportParentGoal {
  id: string;
  title: string;
  description?: string | null;
  domain?: string | null;
  status: string;
  programId?: string | null;
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
  | { kind: "passthrough" };

/**
 * Maps a section title to a structured type that drives auto-population.
 * Matching is keyword-based, case-insensitive.
 * Order matters: mastered_goals must be checked before current_goals.
 */
export function detectSectionType(title: string): SectionType {
  const t = title.toLowerCase();

  if (/service\s+period|provider\s+info/.test(t))
    return { kind: "provider_info" };

  if (/biopsychosocial|biophysical/.test(t))
    return { kind: "biopsychosocial" };

  if (/why\s+(aba|services?\s+(are\s+)?needed)/.test(t))
    return { kind: "why_aba" };

  // mastered_goals must be tested before current_goals
  if (/mastered\s+goals?/.test(t))
    return { kind: "mastered_goals" };

  if ((/current\s+goals?|goals?\s+and\s+objectives/.test(t)) && !/mastered/.test(t))
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

/** 20-character Unicode block progress bar. Uses only text content — no CSS needed. */
function progressBar(mastered: number, total: number): string {
  if (total === 0) return "░░░░░░░░░░░░░░░░░░░░";
  const filled = Math.round(Math.min(1, mastered / total) * 20);
  return "█".repeat(filled) + "░".repeat(20 - filled);
}

function phaseLabel(phase: string): string {
  switch ((phase ?? "").toUpperCase()) {
    case "NEW":             return "New";
    case "ACQUISITION":     return "In Treatment";
    case "BASELINE":        return "Baseline";
    case "MASTERED":        return "Mastered";
    case "MAINTENANCE":     return "Maintenance";
    case "GENERALIZATION":  return "Generalization";
    default:                return phase;
  }
}

/** Small italic note prepended to every auto-generated block. */
function genNote(date: string): string {
  return `<p><em>Auto-generated from live data on ${escapeHtml(date)}. All content is fully editable.</em></p>`;
}

// ── HTML builders ─────────────────────────────────────────────────────────────

/**
 * Service Period / Provider Information section.
 * Produces a two-column info table with all available client and provider data.
 */
export function buildProviderInfoHtml(
  client: ReportClient,
  provider: ReportProvider,
  servicePeriod: ServicePeriod,
  generationDate: string,
): string {
  const age = computeAge(client.dob);

  const rows: [string, string][] = [
    ["Client Name",           escapeHtml(client.name)],
    ["Date of Birth",         `${formatDate(client.dob)} (Age ${age})`],
    ["Diagnosis",             client.diagnosis.length ? escapeHtml(client.diagnosis.join(", ")) : "[Diagnosis]"],
    ["Insurance ID",          client.insuranceId ? escapeHtml(client.insuranceId) : "[Insurance ID]"],
    ["Address",               client.address ? escapeHtml(client.address) : "[Address]"],
    ["School / Program",      client.school ? escapeHtml(client.school) : "[School / Program]"],
    ["Service Period Start",  servicePeriod.start ? escapeHtml(servicePeriod.start) : "[Service Period Start]"],
    ["Service Period End",    servicePeriod.end ? escapeHtml(servicePeriod.end) : "[Service Period End]"],
    ["Assessment Date",       escapeHtml(generationDate)],
    ["Provider Name",         escapeHtml(provider.name)],
    ["Provider Role",         escapeHtml(provider.role)],
    ["Provider Email",        escapeHtml(provider.email)],
    ["Provider Phone",        "[Provider Phone]"],
    ["BCBA Credentials",      "[BCBA Credentials]"],
  ];

  if (client.guardianName) {
    rows.push(["Guardian / Parent", escapeHtml(client.guardianName)]);
  }
  if (client.guardianPhone) {
    rows.push(["Guardian Phone", escapeHtml(client.guardianPhone)]);
  }
  if (client.guardianEmail) {
    rows.push(["Guardian Email", escapeHtml(client.guardianEmail)]);
  }

  const tableRows = rows
    .map(([label, value]) => `<tr><td><strong>${label}</strong></td><td>${value}</td></tr>`)
    .join("\n");

  return [
    genNote(generationDate),
    "<table><tbody>",
    tableRows,
    "</tbody></table>",
  ].join("\n");
}

/**
 * Biopsychosocial Information section.
 * Generates a narrative paragraph with client demographics and clinical notes.
 */
export function buildBiopsychosocialHtml(
  client: ReportClient,
  generationDate: string,
): string {
  const age = computeAge(client.dob);
  const diagText = client.diagnosis.length
    ? `a diagnosis of <strong>${escapeHtml(client.diagnosis.join(", "))}</strong>`
    : "[insert diagnosis / clinical presentation]";

  const parts: string[] = [
    genNote(generationDate),
    `<p><strong>${escapeHtml(client.name)}</strong> is a ${age}-year-old individual with ${diagText}.</p>`,
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
 * Generates a brief rationale paragraph using diagnosis and client info.
 */
export function buildWhyAbaHtml(
  client: ReportClient,
  generationDate: string,
): string {
  const age = computeAge(client.dob);
  const diagText = client.diagnosis.length
    ? escapeHtml(client.diagnosis.join(", "))
    : "[diagnosis]";

  return [
    genNote(generationDate),
    `<p><strong>${escapeHtml(client.name)}</strong>, age ${age}, presents with ${diagText}. `,
    `Applied Behavior Analysis (ABA) services are recommended to address identified skill deficits `,
    `and behavioral needs as documented in this comprehensive assessment.</p>`,
    `<p>[Describe specific functional impairments, skill deficits, behavioral challenges, `,
    `and how ABA services will address these individualized needs.]</p>`,
  ].join("");
}

/**
 * Category-specific goals section (Language, Social, Adaptive, etc.).
 * Matches goals whose Program name/domain contains any of the given keywords.
 * Returns null if no matching goals are found (section left unchanged).
 */
export function buildCategoryGoalsHtml(
  programs: ReportProgram[],
  allGoals: ReportParentGoal[],
  categoryKeywords: string[],
  generationDate: string,
): string | null {
  const kwLower = categoryKeywords.map((k) => k.toLowerCase());

  const matchingProgramIds = new Set<string>(
    programs
      .filter((p) =>
        kwLower.some(
          (kw) =>
            p.name.toLowerCase().includes(kw) ||
            p.domain.toLowerCase().includes(kw),
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

  const allTargets = matchingGoals.flatMap((g) => g.targets);
  const newCount       = allTargets.filter((t) => t.phase === "NEW").length;
  const activeCount    = allTargets.filter((t) => ["ACQUISITION", "BASELINE"].includes(t.phase)).length;
  const masteredCount  = allTargets.filter((t) => t.phase === "MASTERED").length;
  const total          = allTargets.length;
  const bar            = progressBar(masteredCount, total);
  const pct            = total > 0 ? Math.round((masteredCount / total) * 100) : 0;

  const tableRows = matchingGoals.flatMap((g) => {
    if (g.targets.length === 0) {
      return [
        `<tr><td>${escapeHtml(g.title)}</td>` +
        `<td colspan="3"><em>No active targets</em></td></tr>`,
      ];
    }
    return g.targets.map((t, idx) => {
      const dateStr = t.dateMastered ? formatDate(t.dateMastered) : "—";
      return (
        `<tr>` +
        `<td>${idx === 0 ? escapeHtml(g.title) : ""}</td>` +
        `<td>${escapeHtml(t.definition)}</td>` +
        `<td>${phaseLabel(t.phase)}</td>` +
        `<td>${dateStr}</td>` +
        `</tr>`
      );
    });
  });

  return [
    genNote(generationDate),
    `<p><strong>New:</strong> ${newCount} &nbsp;|&nbsp; ` +
    `<strong>In Treatment:</strong> ${activeCount} &nbsp;|&nbsp; ` +
    `<strong>Mastered (past 6 months):</strong> ${masteredCount}</p>`,
    `<p>${bar} ${pct}% mastered (${masteredCount} of ${total} targets)</p>`,
    `<table>`,
    `<thead><tr>` +
    `<th>Skill Area / Goal</th><th>Target / Objective</th>` +
    `<th>Phase</th><th>Date Mastered</th>` +
    `</tr></thead>`,
    `<tbody>`,
    ...tableRows,
    `</tbody></table>`,
  ].join("\n");
}

/**
 * Mastered Goals and Objectives section.
 * Lists all targets mastered within the past 6 months, grouped by category.
 */
export function buildMasteredGoalsHtml(
  allGoals: ReportParentGoal[],
  programs: ReportProgram[],
  generationDate: string,
): string {
  const programMap = new Map(programs.map((p) => [p.id, p.name]));

  const masteredRows = allGoals.flatMap((g) => {
    const category = g.programId
      ? (programMap.get(g.programId) ?? g.domain ?? "—")
      : (g.domain ?? "—");
    return g.targets
      .filter((t) => t.phase === "MASTERED")
      .map((t) => ({ category, goalTitle: g.title, target: t }));
  });

  if (masteredRows.length === 0) {
    return [
      genNote(generationDate),
      `<p><em>No goals were mastered in the past 6 months.</em></p>`,
    ].join("\n");
  }

  const rows = masteredRows.map(({ category, goalTitle, target: t }) =>
    `<tr>` +
    `<td>${escapeHtml(category)}</td>` +
    `<td>${escapeHtml(goalTitle)}</td>` +
    `<td>${escapeHtml(t.definition)}</td>` +
    `<td>${t.dateMastered ? formatDate(t.dateMastered) : "—"}</td>` +
    `<td>${t.notes ? escapeHtml(t.notes) : "—"}</td>` +
    `</tr>`,
  );

  return [
    genNote(generationDate),
    `<p><strong>${masteredRows.length} objective${masteredRows.length !== 1 ? "s" : ""} mastered in the past 6 months.</strong></p>`,
    `<table>`,
    `<thead><tr>` +
    `<th>Category</th><th>Skill Area / Goal</th>` +
    `<th>Target / Objective</th><th>Date Mastered</th><th>Notes</th>` +
    `</tr></thead>`,
    `<tbody>`,
    ...rows,
    `</tbody></table>`,
  ].join("\n");
}

/**
 * Current Goals and Objectives section.
 * Lists all active (non-archived, non-mastered) goals and their targets.
 */
export function buildCurrentGoalsHtml(
  allGoals: ReportParentGoal[],
  programs: ReportProgram[],
  generationDate: string,
): string {
  const programMap = new Map(programs.map((p) => [p.id, p.name]));

  const activeGoals = allGoals.filter(
    (g) => g.status !== "MASTERED" && g.status !== "ARCHIVED",
  );

  if (activeGoals.length === 0) {
    return [
      genNote(generationDate),
      `<p><em>No active goals or targets were found in the system for this client.</em></p>`,
    ].join("\n");
  }

  const totalTargets = activeGoals.reduce((n, g) => n + g.targets.length, 0);

  const rows = activeGoals.flatMap((g) => {
    const category = g.programId
      ? (programMap.get(g.programId) ?? g.domain ?? "—")
      : (g.domain ?? "—");

    if (g.targets.length === 0) {
      return [
        `<tr>` +
        `<td>${escapeHtml(category)}</td>` +
        `<td>${escapeHtml(g.title)}</td>` +
        `<td colspan="3"><em>No targets defined</em></td>` +
        `</tr>`,
      ];
    }

    return g.targets.map((t, idx) =>
      `<tr>` +
      `<td>${idx === 0 ? escapeHtml(category) : ""}</td>` +
      `<td>${idx === 0 ? escapeHtml(g.title) : ""}</td>` +
      `<td>${escapeHtml(t.definition)}</td>` +
      `<td>${phaseLabel(t.phase)}</td>` +
      `<td>${t.baseline ? escapeHtml(t.baseline) : "—"}</td>` +
      `</tr>`,
    );
  });

  return [
    genNote(generationDate),
    `<p><strong>${activeGoals.length} active skill area${activeGoals.length !== 1 ? "s" : ""} ` +
    `with ${totalTargets} target${totalTargets !== 1 ? "s" : ""}.</strong></p>`,
    `<table>`,
    `<thead><tr>` +
    `<th>Category</th><th>Skill Area / Goal</th>` +
    `<th>Target / Objective</th><th>Phase</th><th>Baseline</th>` +
    `</tr></thead>`,
    `<tbody>`,
    ...rows,
    `</tbody></table>`,
  ].join("\n");
}
