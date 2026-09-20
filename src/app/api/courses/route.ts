import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { expireStaleSessions } from "@/lib/session-utils";
import type { CourseDTO } from "@/lib/types";

/** GET /api/courses — role-aware course list with stats */
export async function GET() {
  try {
    const user = await requireUser();
    await expireStaleSessions();

    let courses;
    if (user.role === "TEACHER") {
      courses = await db.course.findMany({
        where: { teacherId: user.id },
        include: {
          teacher: true,
          _count: { select: { enrollments: true, sessions: true } },
          sessions: { select: { id: true, status: true, lat: true, lng: true, startTime: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    } else {
      courses = await db.course.findMany({
        where: { enrollments: { some: { studentId: user.id } } },
        include: {
          teacher: true,
          _count: { select: { enrollments: true, sessions: true } },
          sessions: { select: { id: true, status: true, lat: true, lng: true, startTime: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    const payload: CourseDTO[] = courses.map((c) => {
      const last = [...c.sessions].sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
      const active = c.sessions.find((s) => s.status === "ACTIVE");
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        teacherName: c.teacher.name,
        enrolledCount: c._count.enrollments,
        sessionsHeld: c._count.sessions,
        activeSessionId: active?.id ?? null,
        lastSessionId: last?.id ?? null,
        lastLat: last?.lat ?? null,
        lastLng: last?.lng ?? null,
      };
    });

    return NextResponse.json({ courses: payload });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "Failed to load courses." }, { status });
  }
}

/** POST /api/courses — teacher creates a course */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("TEACHER");
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim().toUpperCase();

    if (name.length < 3) {
      return NextResponse.json({ error: "Course name is too short." }, { status: 400 });
    }
    if (!/^[A-Z0-9-]{3,12}$/.test(code)) {
      return NextResponse.json(
        { error: "Course code must be 3–12 chars (letters, numbers, dashes)." },
        { status: 400 },
      );
    }

    const exists = await db.course.findUnique({ where: { code } });
    if (exists) {
      return NextResponse.json({ error: `Course code ${code} is already in use.` }, { status: 409 });
    }

    const course = await db.course.create({
      data: { name, code, teacherId: user.id },
    });

    return NextResponse.json({ course });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "Failed to create course." }, { status });
  }
}
