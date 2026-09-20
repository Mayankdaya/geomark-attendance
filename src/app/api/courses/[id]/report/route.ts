import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { expireStaleSessions } from "@/lib/session-utils";

/**
 * GET /api/courses/[id]/report — CSV export for a teacher's course.
 * Section 1: per-session attendance log.  Section 2: per-student summary.
 * Prefixed with \uFEFF BOM so Excel renders UTF-8 correctly.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser("TEACHER");
    const { id } = await params;
    await expireStaleSessions();

    const course = await db.course.findUnique({
      where: { id },
      include: {
        sessions: {
          include: { attendance: { orderBy: { timestamp: "asc" } } },
          orderBy: { startTime: "desc" },
        },
        enrollments: { include: { student: true } },
      },
    });

    if (!course || course.teacherId !== user.id) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const rows: string[] = [];
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    rows.push(`Attendance Report,${esc(course.code)},${esc(course.name)}`);
    rows.push(`Teacher,${esc(user.name)},Generated,"${new Date().toLocaleString()}"`);
    rows.push("");

    // Section 1 — session log
    rows.push("SESSION LOG");
    rows.push("Date,Session,Student,Timestamp,Distance (m),GPS Accuracy (m),Status");
    for (const s of course.sessions) {
      const date = s.startTime.toLocaleDateString("en-CA"); // YYYY-MM-DD
      if (s.attendance.length === 0) {
        rows.push(`${esc(date)},${esc(s.id.slice(-6))},(no students present),,, ,`);
      }
      for (const a of s.attendance) {
        rows.push(
          [
            esc(date),
            esc(s.id.slice(-6)),
            esc(a.name),
            esc(a.timestamp.toLocaleString()),
            a.distance.toFixed(1),
            a.accuracy.toFixed(1),
            esc(a.status),
          ].join(","),
        );
      }
    }

    // Section 2 — per-student summary with 75 % rule
    const held = course.sessions.length;
    rows.push("");
    rows.push("STUDENT SUMMARY");
    rows.push("Student,Sessions Attended,Sessions Held,Attendance %,Flag");
    for (const { student } of course.enrollments) {
      const attended = course.sessions.filter((s) =>
        s.attendance.some((a) => a.studentId === student.id),
      ).length;
      const pct = held > 0 ? Math.round((attended / held) * 100) : 0;
      rows.push(
        [
          esc(student.name),
          attended,
          held,
          `${pct}%`,
          pct < 75 ? "LOW ATTENDANCE" : "OK",
        ].join(","),
      );
    }

    const csv = "\uFEFF" + rows.join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${course.code}-attendance-report.csv"`,
      },
    });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "Failed to generate report." }, { status });
  }
}
