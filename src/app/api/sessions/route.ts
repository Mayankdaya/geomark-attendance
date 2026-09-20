import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { expireStaleSessions } from "@/lib/session-utils";
import { SESSION_DURATION_MIN } from "@/lib/geo";

/**
 * POST /api/sessions — teacher starts an attendance session.
 * Body: { courseId, lat, lng, radius? }
 * endTime = now + 10 min (SESSION_DURATION_MIN). One ACTIVE session per course.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("TEACHER");
    await expireStaleSessions();

    const body = await req.json();
    const courseId = String(body.courseId ?? "");
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const radius = Number(body.radius ?? 30);

    if (!courseId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Course and classroom coordinates are required." },
        { status: 400 },
      );
    }

    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course || course.teacherId !== user.id) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const alreadyActive = await db.session.findFirst({
      where: { courseId, status: "ACTIVE" },
    });
    if (alreadyActive) {
      return NextResponse.json(
        { error: "This course already has a live session." },
        { status: 409 },
      );
    }

    const now = new Date();
    const endTime = new Date(now.getTime() + SESSION_DURATION_MIN * 60 * 1000);

    const session = await db.session.create({
      data: {
        courseId,
        status: "ACTIVE",
        startTime: now,
        endTime,
        lat,
        lng,
        radius: radius > 0 ? radius : 30,
      },
    });

    return NextResponse.json({ session });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "Failed to start session." }, { status });
  }
}
