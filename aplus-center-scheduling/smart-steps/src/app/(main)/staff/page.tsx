"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserCheck, Mail, Phone, Award, Users, ChevronDown, ChevronRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type AssignedClient = {
  role: string;
  client: { id: string; name: string; isArchived: boolean };
};

type StaffMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  phone: string | null;
  credentials: string | null;
  createdAt: string;
  assignedClients: AssignedClient[];
};

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-[var(--accent-pink)]/15 text-[var(--accent-pink)] border border-[var(--accent-pink)]/30",
  BCBA:  "bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30",
  RBT:   "bg-[var(--accent-purple)]/15 text-[var(--accent-purple)] border border-[var(--accent-purple)]/30",
};

// ── Staff card ─────────────────────────────────────────────────────────────────

function StaffCard({ member }: { member: StaffMember }) {
  const [expanded, setExpanded] = useState(false);
  const activeClients   = member.assignedClients.filter((a) => !a.client.isArchived);
  const archivedClients = member.assignedClients.filter((a) => a.client.isArchived);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-cyan)]/30 to-[var(--accent-purple)]/30 border border-[var(--glass-border)]">
          <span className="text-sm font-bold text-[var(--foreground)]">
            {(member.name ?? member.email).charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[var(--foreground)] truncate">
              {member.name ?? "(no name)"}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_STYLES[member.role] ?? ROLE_STYLES.RBT}`}>
              {member.role}
            </span>
            {member.credentials && (
              <span className="text-[10px] text-zinc-500 font-medium">{member.credentials}</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {member.email}
            </span>
            {member.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {member.phone}
              </span>
            )}
          </div>
        </div>

        {/* Clients count + expand toggle */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-[var(--glass-border)] px-2.5 py-1 text-xs text-zinc-400">
            <Users className="h-3 w-3" />
            {activeClients.length} client{activeClients.length !== 1 ? "s" : ""}
          </span>
          {member.assignedClients.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg p-1.5 text-zinc-500 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 transition-colors"
              title={expanded ? "Hide clients" : "Show clients"}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded clients list */}
      {expanded && member.assignedClients.length > 0 && (
        <div className="border-t border-[var(--glass-border)] px-4 pb-3 pt-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
            Assigned Clients
          </p>
          <div className="space-y-1">
            {activeClients.map((a) => (
              <div key={a.client.id} className="flex items-center justify-between rounded-lg px-3 py-1.5 bg-white/3">
                <span className="text-sm text-zinc-300">{a.client.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_STYLES[a.role] ?? ROLE_STYLES.RBT}`}>
                  {a.role}
                </span>
              </div>
            ))}
            {archivedClients.length > 0 && (
              <div className="mt-1 border-t border-[var(--glass-border)] pt-1">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-700">Archived clients</p>
                {archivedClients.map((a) => (
                  <div key={a.client.id} className="flex items-center justify-between rounded-lg px-3 py-1 opacity-50">
                    <span className="text-xs text-zinc-500 line-through">{a.client.name}</span>
                    <span className="text-[10px] text-zinc-600">{a.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [staff,   setStaff]   = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<"ALL" | "ADMIN" | "BCBA" | "RBT">("ALL");

  const userRole = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/smart-steps/api/staff");
      if (!r.ok) throw new Error();
      setStaff(await r.json());
    } catch {
      /* handled by loading state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // RBT: access denied
  if (status !== "loading" && userRole === "RBT") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <UserCheck className="h-10 w-10 text-zinc-700" />
        <p className="text-sm text-zinc-500">Staff directory is available to BCBA and Admin users.</p>
      </div>
    );
  }

  const filtered = filter === "ALL" ? staff : staff.filter((m) => m.role === filter);

  const counts = {
    ALL:   staff.length,
    ADMIN: staff.filter((m) => m.role === "ADMIN").length,
    BCBA:  staff.filter((m) => m.role === "BCBA").length,
    RBT:   staff.filter((m) => m.role === "RBT").length,
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <UserCheck className="h-6 w-6 text-[var(--accent-cyan)]" />
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Staff</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          All staff members and their client assignments.
          To assign or remove a staff member from a client, open the client&#39;s profile and use the Assigned Staff section.
        </p>
      </motion.div>

      {/* Role filter tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(["ALL", "ADMIN", "BCBA", "RBT"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setFilter(r)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              filter === r
                ? "bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] border-[var(--accent-cyan)]/40"
                : "border-[var(--glass-border)] text-zinc-500 hover:border-[var(--accent-cyan)]/30 hover:text-zinc-300"
            }`}
          >
            {r === "ALL" ? "All" : r}{" "}
            <span className="ml-0.5 opacity-60">({counts[r]})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 glass-card animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Award className="h-10 w-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            {filter === "ALL" ? "No staff members found." : `No ${filter} users found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => (
            <StaffCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
