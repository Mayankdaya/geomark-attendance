import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { expireStaleSessions } from "@/lib/session-utils";
import { haversineDistance, MAX_ACCURACY_M, formatDistance } from "@/lib/geo";
import type { MarkResult, MarkError } from "@/lib/types";

/**
 * POST /api/attendance — student marks attendance (anti-proxy pipeline):
 *   1. session must be ACTIVE and not expired (10-min rule, lazy enforced)
 *   2. student must be enrolled in the course
 *   3. GPS accuracy must be ≤ 20 m (rejects unreliable fixes)
 *   4. Haversine distance to classroom must be ≤ session radius (30 m)
 *   5. one record per student per session (unique constraint)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("STUDENT");
    await expireStaleSessions();

    const body = await req.json();
    const sessionId = String(body.sessionId ?? "");
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const accuracy = Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : 9999;

    if (!sessionId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json<MarkError>(
        { ok: false, code: "ERROR", message: "Location data is required to mark attendance." },
        { status: 400 },
      );
    }

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { course: true },
    });

    if (!session || session.endTime < new Date() || session.status !== "ACTIVE") {
      return NextResponse.json<MarkError>(
        { ok: false, code: "EXPIRED", message: "This session has ended. Attendance can no longer be marked." },
        { status: 410 },
      );
    }

    const enrolled = await db.enrollment.findUnique({
      where: { courseId_studentId: { courseId: session.courseId, studentId: user.id } },
    });
    if (!enrolled) {
      return NextResponse.json<MarkError>(
        { ok: false, code: "ERROR", message: `You are not enrolled in ${session.course.code}.` },
        { status: 403 },
      );
    }

    // Anti-proxy gate 1 — GPS accuracy
    if (accuracy > MAX_ACCURACY_M) {
      return NextResponse.json<MarkError>({
        ok: false,
        code: "LOW_ACCURACY",
        message: `GPS accuracy too low (±${Math.round(accuracy)} m). Move near a window or turn off battery saver, then retry (needs ±${MAX_ACCURACY_M} m).`,
      });
    }

    // Anti-proxy gate 2 — Haversine geofence
    const distance = haversineDistance(lat, lng, session.lat, session.lng);
    if (distance > session.radius) {
      return NextResponse.json<MarkError>({
        ok: false,
        code: "OUT_OF_RANGE",
        message: `You are ${formatDistance(distance)} away — move closer to ${session.course.code} to mark attendance.`,
        distance: Math.round(distance),
      });
    }

    // Anti-proxy gate 3 — deduplicate (unique sessionId+studentId)
    try {
      const record = await db.attendance.create({
        data: {
          sessionId: session.id,
          studentId: user.id,
          name: user.name,
          distance: Math.round(distance * 10) / 10,
          accuracy: Math.round(accuracy * 10) / 10,
          status: "PRESENT",
        },
      });

      return NextResponse.json<MarkResult>({
        ok: true,
        message: `Present! Marked ${formatDistance(distance)} from the classroom.`,
        distance: Math.round(distance),
        accuracy: Math.round(accuracy),
        timestamp: record.timestamp.toISOString(),
      });
    } catch {
      return NextResponse.json<MarkError>(
        { ok: false, code: "DUPLICATE", message: "You have already marked attendance for this session." },
        { status: 409 },
      );
    }
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json<MarkError>(
      { ok: false, code: "ERROR", message: "Something went wrong. Please try again." },
      { status },
    );
  }
}
