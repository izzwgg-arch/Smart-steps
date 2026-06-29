import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/ensureUser";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  try {
    const sessions = await prisma.session.findMany({
      where: clientId ? { clientId } : {},
      orderBy: { startedAt: "desc" },
      take: limit,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
        mode: true,
        clientId: true,
        user: { select: { name: true } },
        _count: { select: { trials: true } },
        trials: {
          where: { deletedAt: null },
          select: { result: true },
        },
      },
    });

    const result = sessions.map((s) => {
      const correct = s.trials.filter((t) => t.result === "CORRECT" || t.result === "INDEPENDENT").length;
      const total = s.trials.length;
      return {
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        createdAt: s.createdAt,
        mode: s.mode,
        clientId: s.clientId,
        trialCount: total,
        pctCorrect: total > 0 ? (correct / total) * 100 : null,
        therapistName: s.user?.name ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guarantee the SSO user exists in the smart_steps.User table
  await ensureUser({
    id: userId,
    email: session.user?.email,
    name: session.user?.name,
    role: (session.user as { role?: string })?.role,
  });

  try {
    const body = await req.json();
    const { clientId, mode, startedAt, endedAt, providerId } = body as {
      clientId?: string;
      mode?: string;
      startedAt?: string;
      endedAt?: string;
      providerId?: string;
    };
    if (!clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }
    const sessionRecord = await prisma.session.create({
      data: {
        clientId,
        userId: providerId ?? userId,
        mode: mode || "DTT",
        ...(startedAt ? { startedAt: new Date(startedAt) } : {}),
        ...(endedAt ? { endedAt: new Date(endedAt) } : {}),
      },
    });
    return NextResponse.json({ id: sessionRecord.id });
  } catch (e) {
    console.error("POST /sessions error:", e);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
