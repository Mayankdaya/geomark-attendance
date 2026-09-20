import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";

/**
 * POST /api/courses/join — student joins courses.
 * Body: { code? } → join by course code; if omitted, join ALL courses (demo shortcut).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("STUDENT");
    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? "").trim().toUpperCase();

    if (code) {
      const course = await db.course.findUnique({ where: { code } });
      if (!course) {
        return NextResponse.json({ error: `No course found with code ${code}.` }, { status: 404 });
      }
      await db.enrollment.upsert({
        where: { courseId_studentId: { courseId: course.id, studentId: user.id } },
        create: { courseId: course.id, studentId: user.id },
        update: {},
      });
      return NextResponse.json({ joined: [course.code] });
    }

    // Demo shortcut — join everything
    const all = await db.course.findMany({ select: { id: true, code: true } });
    for (const c of all) {
      await db.enrollment.upsert({
        where: { courseId_studentId: { courseId: c.id, studentId: user.id } },
        create: { courseId: c.id, studentId: user.id },
        update: {},
      });
    }
    return NextResponse.json({ joined: all.map((c) => c.code) });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: "Failed to join course." }, { status });
  }
}
