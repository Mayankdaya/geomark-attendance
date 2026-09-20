import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import type { HistoryRow } from "@/lib/types";

/** GET /api/attendance/history — the logged-in student's full attendance log */
export async function GET() {
  try {
    const user = await requireUser("STUDENT");

    const records = await db.attendance.findMany({
      where: { studentId: user.id },
      include: { session: { include: { course: true } } },
      orderBy: { timestamp: "desc" },
    });

    const history: HistoryRow[] = records.map((r) => ({
      id: r.id,
      courseName: r.session.course.name,
      courseCode: r.session.course.code,
      date: r.session.startTime.toISOString(),
      timestamp: r.timestamp.toISOString(),
      distance: r.distance,
      status: r.status,
    }));

    return NextResponse.json({ history });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "Failed to load history." }, { status });
  }
}
