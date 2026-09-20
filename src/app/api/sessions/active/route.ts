import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { expireStaleSessions } from "@/lib/session-utils";
import type { ActiveSessionDTO } from "@/lib/types";

/**
 * GET /api/sessions/active
 *  - teacher → their own ACTIVE sessions
 *  - student → ACTIVE sessions of enrolled courses (+ markedByMe flag)
 */
export async function GET() {
  try {
    const user = await requireUser();
    await expireStaleSessions();

    const where =
      user.role === "TEACHER"
        ? { status: "ACTIVE" as const, course: { teacherId: user.id } }
        : { status: "ACTIVE" as const, course: { enrollments: { some: { studentId: user.id } } } };

    const sessions = await db.session.findMany({
      where,
      include: {
        course: { include: { teacher: true } },
        attendance: { select: { studentId: true, distance: true } },
      },
      orderBy: { startTime: "desc" },
    });

    const payload: ActiveSessionDTO[] = sessions.map((s) => {
      const mine =
        user.role === "STUDENT" ? s.attendance.find((a) => a.studentId === user.id) : undefined;
      return {
        id: s.id,
        courseId: s.courseId,
        courseName: s.course.name,
        courseCode: s.course.code,
        teacherName: s.course.teacher.name,
        status: "ACTIVE",
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        lat: s.lat,
        lng: s.lng,
        radius: s.radius,
        presentCount: s.attendance.length,
        markedByMe: Boolean(mine),
        myDistance: mine?.distance ?? null,
      };
    });

    return NextResponse.json({ sessions: payload });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "Failed to load active sessions." }, { status });
  }
}
