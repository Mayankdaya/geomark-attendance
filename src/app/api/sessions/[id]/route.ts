import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { expireStaleSessions } from "@/lib/session-utils";
import { LOW_ATTENDANCE_THRESHOLD } from "@/lib/geo";
import type { LiveAttendanceRow, StudentStat } from "@/lib/types";

/** GET /api/sessions/[id] — session detail: live attendance + per-student course stats */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser("TEACHER");
    const { id } = await params;
    await expireStaleSessions();

    const session = await db.session.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            teacher: true,
            enrollments: { include: { student: true } },
            sessions: {
              select: { id: true, attendance: { select: { studentId: true } } },
            },
          },
        },
        attendance: { orderBy: { timestamp: "asc" } },
      },
    });

    if (!session || session.course.teacherId !== user.id) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const attendance: LiveAttendanceRow[] = session.attendance.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      name: a.name,
      timestamp: a.timestamp.toISOString(),
      distance: a.distance,
      accuracy: a.accuracy,
    }));

    // Per-student attendance % across ALL sessions of this course (75 % rule)
    const held = session.course.sessions.length;
    const stats: StudentStat[] = session.course.enrollments
      .map(({ student }) => {
        const attended = session.course.sessions.filter((s) =>
          s.attendance.some((a) => a.studentId === student.id),
        ).length;
        const percent = held > 0 ? Math.round((attended / held) * 100) : 0;
        return { studentId: student.id, name: student.name, attended, held, percent };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      session: {
        id: session.id,
        courseId: session.courseId,
        courseName: session.course.name,
        courseCode: session.course.code,
        status: session.status,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
        lat: session.lat,
        lng: session.lng,
        radius: session.radius,
        presentCount: attendance.length,
        enrolledCount: session.course.enrollments.length,
      },
      attendance,
      stats,
      lowThreshold: LOW_ATTENDANCE_THRESHOLD,
    });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "Failed to load session." }, { status });
  }
}

/** PATCH /api/sessions/[id] — teacher ends the session early */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser("TEACHER");
    const { id } = await params;

    const session = await db.session.findUnique({ where: { id }, include: { course: true } });
    if (!session || session.course.teacherId !== user.id) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    await db.session.update({ where: { id }, data: { status: "ENDED" } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "Failed to end session." }, { status });
  }
}
