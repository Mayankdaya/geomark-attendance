// Seed script — run: bun run db:seed
// Creates demo teacher, students, courses, historical sessions & attendance
// so dashboards, percentages and CSV exports have meaningful data.
import { PrismaClient } from "../src/generated/prisma/index.js";
import { randomBytes, scryptSync } from "crypto";

const db = new PrismaClient();

function hash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

// Demo classroom — "Tech Block · Room 204"
const CLASS = { lat: 28.5462, lng: 77.193, radius: 30 };

function daysAgoAt(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function jitter(m: number): number {
  return Math.round((m + (Math.random() * 6 - 3)) * 10) / 10; // ±3 m noise
}

async function main() {
  const existing = await db.user.findUnique({ where: { email: "sarah@campus.edu" } });
  if (existing) {
    console.log("Database already seeded — skipping.");
    return;
  }

  console.log("Seeding demo data…");

  const teacher = await db.user.create({
    data: {
      name: "Dr. Sarah Mitchell",
      email: "sarah@campus.edu",
      password: hash("teacher123"),
      role: "TEACHER",
    },
  });

  const names = [
    ["Alex Carter", "alex@campus.edu"],
    ["Priya Sharma", "priya@campus.edu"],
    ["Jordan Lee", "jordan@campus.edu"],
    ["Maya Patel", "maya@campus.edu"],
    ["Sam Rivera", "sam@campus.edu"],
    ["Elena Rodriguez", "elena@campus.edu"],
  ] as const;

  const students: Record<string, { id: string; name: string }> = {};
  for (const [name, email] of names) {
    const u = await db.user.create({
      data: { name, email, password: hash("student123"), role: "STUDENT" },
    });
    students[name] = { id: u.id, name: u.name };
  }

  const cs101 = await db.course.create({
    data: { name: "Introduction to Programming", code: "CS-101", teacherId: teacher.id },
  });
  const cs205 = await db.course.create({
    data: { name: "Data Structures & Algorithms", code: "CS-205", teacherId: teacher.id },
  });
  const ge310 = await db.course.create({
    data: { name: "GIS & Mapping Fundamentals", code: "GE-310", teacherId: teacher.id },
  });

  const enroll = async (courseId: string, studentIds: string[]) => {
    for (const studentId of studentIds) {
      await db.enrollment.create({ data: { courseId, studentId } });
    }
  };
  const all = Object.values(students).map((s) => s.id);
  await enroll(cs101.id, all);
  await enroll(cs205.id, ["Alex Carter", "Priya Sharma", "Jordan Lee", "Maya Patel"].map((n) => students[n].id));
  await enroll(ge310.id, ["Alex Carter", "Priya Sharma", "Sam Rivera"].map((n) => students[n].id));

  // Historical sessions: [course, day, hour, present-student-names]
  const plan: Array<[string, number, number, string[]]> = [
    [cs101.id, 9, 9, ["Alex Carter", "Priya Sharma", "Jordan Lee", "Maya Patel", "Sam Rivera", "Elena Rodriguez"]],
    [cs101.id, 7, 9, ["Alex Carter", "Priya Sharma", "Maya Patel", "Sam Rivera"]],
    [cs101.id, 5, 9, ["Alex Carter", "Jordan Lee", "Maya Patel", "Elena Rodriguez"]],
    [cs101.id, 3, 9, ["Alex Carter", "Priya Sharma", "Maya Patel", "Sam Rivera"]],
    [cs205.id, 8, 11, ["Alex Carter", "Priya Sharma", "Maya Patel"]],
    [cs205.id, 6, 11, ["Alex Carter", "Jordan Lee", "Maya Patel"]],
    [cs205.id, 4, 11, ["Alex Carter", "Priya Sharma"]],
    [ge310.id, 6, 14, ["Alex Carter", "Sam Rivera"]],
    [ge310.id, 2, 14, ["Alex Carter", "Priya Sharma", "Sam Rivera"]],
  ];

  for (const [courseId, day, hour, present] of plan) {
    const start = daysAgoAt(day, hour);
    const session = await db.session.create({
      data: {
        courseId,
        status: "ENDED",
        startTime: start,
        endTime: new Date(start.getTime() + 10 * 60 * 1000),
        lat: CLASS.lat,
        lng: CLASS.lng,
        radius: CLASS.radius,
      },
    });
    for (const name of present) {
      await db.attendance.create({
        data: {
          sessionId: session.id,
          studentId: students[name].id,
          name: students[name].name,
          timestamp: new Date(start.getTime() + (25 + Math.random() * 130) * 1000),
          distance: jitter(3 + Math.random() * 24),
          accuracy: Math.round((4 + Math.random() * 12) * 10) / 10,
          status: "PRESENT",
        },
      });
    }
  }

  console.log("Seed complete:");
  console.log("  Teacher → sarah@campus.edu / teacher123");
  console.log("  Student → alex@campus.edu / student123 (or any @campus.edu above)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
