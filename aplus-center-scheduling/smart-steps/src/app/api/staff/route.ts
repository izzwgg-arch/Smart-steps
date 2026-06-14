import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * GET /smart-steps/api/staff
 * Returns all users with their client assignments.
 * Reuses existing User + ClientAssignment models — no schema changes.
 * ADMIN / BCBA only.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "BCBA") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id:          true,
        name:        true,
        email:       true,
        role:        true,
        phone:       true,
        credentials: true,
        createdAt:   true,
        assignedClients: {
          select: {
            role: true,
            client: {
              select: { id: true, name: true, isArchived: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error("[staff GET]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
