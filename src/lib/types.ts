// Shared API contract types (client ↔ server)

export type Role = "TEACHER" | "STUDENT";

export type MeResponse = {
  user: { id: string; name: string; email: string; role: Role } | null;
};

export type CourseDTO = {
  id: string;
  name: string;
  code: string;
  teacherName: string;
  enrolledCount: number;
  sessionsHeld: number;
  activeSessionId: string | null;
  lastSessionId: string | null; // most recent session (any status) — powers offline roster view
  lastLat: number | null; // last known classroom coords (session prefill)
  lastLng: number | null;
};

export type LiveAttendanceRow = {
  id: string;
  studentId: string;
  name: string;
  timestamp: string; // ISO
  distance: number; // meters
  accuracy: number; // meters
};

export type StudentStat = {
  studentId: string;
  name: string;
  attended: number;
  held: number;
  percent: number; // 0–100
};

export type ActiveSessionDTO = {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  teacherName: string;
  status: "ACTIVE" | "ENDED";
  startTime: string; // ISO
  endTime: string; // ISO
  lat: number;
  lng: number;
  radius: number;
  presentCount: number;
  markedByMe: boolean; // student view: already marked?
  myDistance: number | null; // student view: stored distance if marked
};

export type HistoryRow = {
  id: string;
  courseName: string;
  courseCode: string;
  date: string; // ISO
  timestamp: string; // ISO
  distance: number;
  status: string;
};

export type MarkResult = {
  ok: true;
  message: string;
  distance: number;
  accuracy: number;
  timestamp: string;
};

export type MarkError = {
  ok: false;
  code: "OUT_OF_RANGE" | "LOW_ACCURACY" | "DUPLICATE" | "EXPIRED" | "ERROR";
  message: string;
  distance?: number;
};
