"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Braces, Table2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

// ── Types returned by GET /api/db/inspect ────────────────────
type InspectUser = { id: string; name: string; email: string; role: string; createdAt: string };
type InspectCourse = {
  id: string; code: string; name: string; teacherId: string;
  teacherName: string; enrolledCount: number; sessionsHeld: number; createdAt: string;
};
type InspectSession = {
  id: string; courseId: string; courseCode: string; courseName: string;
  status: string; startTime: string; endTime: string;
  lat: number; lng: number; radius: number;
};
type InspectAttendance = {
  id: string; sessionId: string; courseCode: string; studentId: string;
  name: string; timestamp: string; distance: number; accuracy: number; status: string;
};
type InspectResponse = {
  meta: {
    engine: string;
    file: string;
    firestoreMirror: Record<string, string>;
    generatedAt: string;
    counts: { users: number; courses: number; sessions: number; attendance: number };
  };
  collections: {
    users: InspectUser[];
    courses: InspectCourse[];
    sessions: InspectSession[];
    attendance: InspectAttendance[];
  };
};

// ── Small formatting helpers (mono ledger style) ─────────────
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "2-digit" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-CA", { hour12: false });
const fmtCoords = (lat: number, lng: number) =>
  `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
const shortId = (id: string) => `…${id.slice(-6)}`;

/** Registrar stamp — small uppercase bordered chip. */
function Stamp({ tone, children }: { tone: "leaf" | "faint" | "clay"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium tracking-[0.08em] uppercase",
        tone === "leaf" && "border-leaf/35 bg-leaf-tint text-leaf-deep",
        tone === "clay" && "border-clay/35 bg-clay-tint text-clay-deep",
        tone === "faint" && "border-line-strong bg-paper-deep text-faint",
      )}
    >
      {children}
    </span>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("eyebrow px-4 py-2.5 text-left font-normal", className)}>{children}</th>
  );
}
function Td({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td className={cn("px-4 py-2.5 align-middle", className)} title={title}>{children}</td>;
}

/** Shared ledger table shell — hairline ruled, mono numerals. */
function Ledger({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="border-b border-line bg-paper">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

// ── The inspector view ───────────────────────────────────────
export function DatabaseView({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<InspectResponse | null>(null);
  const [live, setLive] = useState(true); // auto-refresh every 3 s
  const [showJson, setShowJson] = useState(false);
  const [tab, setTab] = useState("attendance");
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const { data } = await api<InspectResponse>("/api/db/inspect");
      if (data) setData(data);
    } finally {
      busyRef.current = false;
    }
  }, []);

  // initial load + live polling (watch writes land in real time)
  useEffect(() => {
    load();
    if (!live) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load, live]);

  const c = data?.collections;
  const counts = data?.meta.counts;

  return (
    <main className="min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 px-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowJson((v) => !v)} className="gap-2">
              {showJson ? <Table2 className="h-4 w-4" /> : <Braces className="h-4 w-4" />}
              {showJson ? "Tables" : "Raw JSON"}
            </Button>
            <Button
              variant={live ? "default" : "outline"}
              size="sm"
              onClick={() => setLive((v) => !v)}
              className="gap-2"
              title={live ? "Auto-refreshing every 3 s — click to pause" : "Paused — click to auto-refresh"}
            >
              {live && <span className="live-dot" />}
              {live ? "Live" : "Paused"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {/* ── Title + spec strip ── */}
        <p className="eyebrow">Inspector</p>
        <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">
          The database, <span className="italic text-leaf-deep">live</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Every row in the system, exactly as stored — the four collections mirror the
          original Firestore design one-to-one. Keep this page open next to a check-in
          and watch the write appear.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
          {[
            { k: "users", n: counts?.users },
            { k: "courses", n: counts?.courses },
            { k: "sessions", n: counts?.sessions },
            { k: "attendance", n: counts?.attendance },
          ].map(({ k, n }) => (
            <div key={k} className="bg-card p-4">
              <div className="eyebrow">{k}</div>
              <div className="mt-1 font-serif text-2xl tabular-nums">
                {n === undefined ? "—" : n}
              </div>
            </div>
          ))}
        </div>

        {/* ── Collections ── */}
        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="attendance">attendance</TabsTrigger>
            <TabsTrigger value="sessions">sessions</TabsTrigger>
            <TabsTrigger value="courses">courses</TabsTrigger>
            <TabsTrigger value="users">users</TabsTrigger>
          </TabsList>

          {/* ── ATTENDANCE ── */}
          <TabsContent value="attendance" className="mt-4">
            {showJson ? (
              <JsonBlock value={c?.attendance} />
            ) : (
              <Ledger
                head={
                  <>
                    <Th>Student</Th><Th>Course</Th><Th>Marked at</Th>
                    <Th className="text-right">Distance</Th><Th className="text-right">±Accuracy</Th><Th>Status</Th>
                  </>
                }
              >
                {(c?.attendance ?? []).map((a) => (
                  <tr key={a.id}>
                    <Td className="font-medium">{a.name}</Td>
                    <Td className="font-mono text-xs text-ink-soft">{a.courseCode}</Td>
                    <Td className="font-mono text-xs tabular-nums">
                      {fmtDay(a.timestamp)} <span className="text-faint">{fmtTime(a.timestamp)}</span>
                    </Td>
                    <Td className="text-right font-mono text-xs tabular-nums">{a.distance.toFixed(1)} m</Td>
                    <Td className="text-right font-mono text-xs tabular-nums text-faint">±{a.accuracy.toFixed(0)} m</Td>
                    <Td><Stamp tone="leaf">{a.status}</Stamp></Td>
                  </tr>
                ))}
                {!c?.attendance.length && <EmptyRow cols={6} />}
              </Ledger>
            )}
          </TabsContent>

          {/* ── SESSIONS ── */}
          <TabsContent value="sessions" className="mt-4">
            {showJson ? (
              <JsonBlock value={c?.sessions} />
            ) : (
              <Ledger
                head={
                  <>
                    <Th>Course</Th><Th>Status</Th><Th>Window</Th>
                    <Th>Geofence center</Th><Th className="text-right">Radius</Th><Th>Doc ID</Th>
                  </>
                }
              >
                {(c?.sessions ?? []).map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <span className="font-medium">{s.courseCode}</span>
                      <span className="ml-2 hidden text-xs text-faint md:inline">{s.courseName}</span>
                    </Td>
                    <Td>
                      <Stamp tone={s.status === "ACTIVE" ? "leaf" : "faint"}>{s.status}</Stamp>
                    </Td>
                    <Td className="font-mono text-xs tabular-nums">
                      {fmtDay(s.startTime)} <span className="text-faint">{fmtTime(s.startTime)}</span>
                      <span className="mx-1 text-line-strong">→</span>
                      {fmtTime(s.endTime)}
                    </Td>
                    <Td className="font-mono text-xs">{fmtCoords(s.lat, s.lng)}</Td>
                    <Td className="text-right font-mono text-xs tabular-nums">{s.radius.toFixed(0)} m</Td>
                    <Td className="font-mono text-xs text-faint" title={s.id}>{shortId(s.id)}</Td>
                  </tr>
                ))}
                {!c?.sessions.length && <EmptyRow cols={6} />}
              </Ledger>
            )}
          </TabsContent>

          {/* ── COURSES ── */}
          <TabsContent value="courses" className="mt-4">
            {showJson ? (
              <JsonBlock value={c?.courses} />
            ) : (
              <Ledger
                head={
                  <>
                    <Th>Code</Th><Th>Course</Th><Th>Teacher</Th>
                    <Th className="text-right">Enrolled</Th><Th className="text-right">Sessions held</Th>
                  </>
                }
              >
                {(c?.courses ?? []).map((k) => (
                  <tr key={k.id}>
                    <Td className="font-mono text-xs">{k.code}</Td>
                    <Td className="font-medium">{k.name}</Td>
                    <Td className="text-ink-soft">{k.teacherName}</Td>
                    <Td className="text-right font-mono text-xs tabular-nums">{k.enrolledCount}</Td>
                    <Td className="text-right font-mono text-xs tabular-nums">{k.sessionsHeld}</Td>
                  </tr>
                ))}
                {!c?.courses.length && <EmptyRow cols={5} />}
              </Ledger>
            )}
          </TabsContent>

          {/* ── USERS ── */}
          <TabsContent value="users" className="mt-4">
            {showJson ? (
              <JsonBlock value={c?.users} />
            ) : (
              <Ledger
                head={
                  <>
                    <Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Joined</Th><Th>Doc ID</Th>
                  </>
                }
              >
                {(c?.users ?? []).map((u) => (
                  <tr key={u.id}>
                    <Td className="font-medium">{u.name}</Td>
                    <Td className="font-mono text-xs text-ink-soft">{u.email}</Td>
                    <Td>
                      <Stamp tone={u.role === "TEACHER" ? "leaf" : "faint"}>{u.role}</Stamp>
                    </Td>
                    <Td className="font-mono text-xs tabular-nums text-faint">{fmtDay(u.createdAt)}</Td>
                    <Td className="font-mono text-xs text-faint" title={u.id}>{shortId(u.id)}</Td>
                  </tr>
                ))}
                {!c?.users.length && <EmptyRow cols={5} />}
              </Ledger>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Where the data physically lives ── */}
        <div className="mt-8 rounded-lg border border-line bg-card p-4 sm:p-5">
          <div className="eyebrow">Where this lives</div>
          <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
            <p className="text-ink-soft">
              Engine <span className="ml-2 font-mono text-xs text-ink">{data?.meta.engine ?? "—"}</span>
              <br />
              File <span className="ml-2 font-mono text-xs text-ink">{data?.meta.file ?? "—"}</span>
            </p>
            <p className="text-ink-soft">
              Firestore mapping —{" "}
              {data &&
                Object.entries(data.meta.firestoreMirror)
                  .map(([k, v]) => (
                    <span key={k} className="mr-2 font-mono text-xs text-ink">
                      {k}→{v}
                    </span>
                  ))}
              <br />
              Snapshot taken <span className="ml-1 font-mono text-xs text-ink">{data ? fmtDay(data.meta.generatedAt) + " " + fmtTime(data.meta.generatedAt) : "—"}</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[460px] overflow-auto rounded-lg border border-line bg-card p-4 font-mono text-xs leading-relaxed text-ink-soft">
      {value === undefined ? "Loading…" : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-sm text-faint">
        No rows yet — they will appear here the moment they are written.
      </td>
    </tr>
  );
}
