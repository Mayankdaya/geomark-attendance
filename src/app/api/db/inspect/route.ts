import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/db/inspect — live read of every table in the database.
 *
 * This powers the in-app "Database" inspector view (the answer to
 * "where can I see the database?"). The four collections mirror the
 * original Firestore spec 1:1:
 *
 *   users      → User
 *   courses    → Course
 *   sessions   → Session
 *   attendance → Attendance
 *
 * NOTE: this endpoint is intentionally open in the sandbox demo so the
 * database can be inspected without logging in. Password hashes are
 * stripped below. In a production deployment this route must be
 * restricted to admin/teacher sessions.
 */
export async function GET() {
  // Fetch everything in parallel — four independent reads.
  const [users, courses, sessions, attendance] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      }, // password deliberately excluded
    }),
    db.course.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        teacher: { select: { name: true } },
        _count: { select: { enrollments: true, sessions: true } },
      },
    }),
    db.session.findMany({
      orderBy: { startTime: "desc" },
      take: 100, // newest 100 — enough for inspection without huge payloads
      include: { course: { select: { code: true, name: true } } },
    }),
    db.attendance.findMany({
      orderBy: { timestamp: "desc" },
      take: 200, // newest 200 marks
      include: { session: { select: { course: { select: { code: true } } } } },
    }),
  ]);

  return NextResponse.json({
    meta: {
      engine: "SQLite via Prisma ORM",
      file: "db/attendance.db",
      firestoreMirror: {
        users: "User",
        courses: "Course",
        sessions: "Session",
        attendance: "Attendance",
      },
      generatedAt: new Date().toISOString(),
      counts: {
        users: users.length,
        courses: courses.length,
        sessions: sessions.length,
        attendance: attendance.length,
      },
    },
    collections: {
      users: users,
      courses: courses.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        teacherId: c.teacherId,
        teacherName: c.teacher.name,
        enrolledCount: c._count.enrollments,
        sessionsHeld: c._count.sessions,
        createdAt: c.createdAt,
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        courseId: s.courseId,
        courseCode: s.course.code,
        courseName: s.course.name,
        status: s.status,
        startTime: s.startTime,
        endTime: s.endTime,
        lat: s.lat,
        lng: s.lng,
        radius: s.radius,
      })),
      attendance: attendance.map((a) => ({
        id: a.id,
        sessionId: a.sessionId,
        courseCode: a.session.course.code,
        studentId: a.studentId,
        name: a.name,
        timestamp: a.timestamp,
        distance: a.distance,
        accuracy: a.accuracy,
        status: a.status,
      })),
    },
  });
}
