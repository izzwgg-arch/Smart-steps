import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId } = await params;

  try {
    const goals = await prisma.parentGoal.findMany({
      where: {
        clientId,
        status: { not: "ARCHIVED" },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      include: {
        subGoals: {
          where: { status: { not: "ARCHIVED" } },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          include: {
            targets: {
              where: { isActive: true },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            },
          },
        },
        targets: {
          where: { isActive: true, subGoalId: null },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        program: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(goals);
  } catch (err) {
    console.error("GET /api/clients/[clientId]/goals error:", err);
    return NextResponse.json({ error: "Failed to load goals" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;

  try {
    const body = await req.json();
    const { title, description, domain, programId, priority, targetDate, notes } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const goal = await prisma.parentGoal.create({
      data: {
        clientId,
        title: title.trim(),
        description: description?.trim() || null,
        domain: domain?.trim() || null,
        programId: programId || null,
        priority: priority ?? 0,
        targetDate: targetDate ? new Date(targetDate) : null,
        notes: notes?.trim() || null,
        status: "ACTIVE",
      },
      include: {
        subGoals: true,
        targets: true,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (err) {
    console.error("POST /api/clients/[clientId]/goals error:", err);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}
