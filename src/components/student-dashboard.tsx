"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  LogOut, MapPin, CheckCircle2, XCircle, Timer,
  Loader2, FlaskConical, UserPlus, KeyRound, Check, GraduationCap, Database,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { CountdownRing } from "@/components/countdown-ring";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api, post, getPosition, formatCountdown } from "@/lib/client";
import { simulateGpsFix } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { SafeUser } from "@/lib/auth";
import type { ActiveSessionDTO, CourseDTO, HistoryRow } from "@/lib/types";

type MarkState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "success"; message: string; distance: number }
  | { kind: "error"; message: string };

type SimMode = "door" | "near" | "far";

const SIM_LABELS: Record<SimMode, { label: string; hint: string }> = {
  door: { label: "At the classroom door", hint: "~2 m — inside geofence" },
  near: { label: "Corridor nearby", hint: "~15 m — inside geofence" },
  far: { label: "Outside the building", hint: "~45 m — out of range" },
};

export function StudentDashboard({
  user,
  onLogout,
  onOpenDatabase,
}: {
  user: SafeUser;
  onLogout: () => void;
  onOpenDatabase: () => void;
}) {
  const [sessions, setSessions] = useState<ActiveSessionDTO[] | null>(null);
  const [courses, setCourses] = useState<CourseDTO[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [marks, setMarks] = useState<Record<string, MarkState>>({});
  const [now, setNow] = useState(Date.now());
  const [joinCode, setJoinCode] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    const { data } = await api<{ sessions: ActiveSessionDTO[] }>("/api/sessions/active");
    setSessions(data.sessions);
  }, []);

  const loadCourses = useCallback(async () => {
    const { data } = await api<{ courses: CourseDTO[] }>("/api/courses");
    setCourses(data.courses);
  }, []);

  const loadHistory = useCallback(async () => {
    const { data } = await api<{ history: HistoryRow[] }>("/api/attendance/history");
    setHistory(data.history);
  }, []);

  useEffect(() => {
    loadSessions();
    loadCourses();
    loadHistory();
  }, [loadSessions, loadCourses, loadHistory]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    pollRef.current = setInterval(loadSessions, 5000);
    return () => {
      clearInterval(t);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadSessions]);

  const setMark = (id: string, s: MarkState) =>
    setMarks((prev) => ({ ...prev, [id]: s }));

  const mark = async (session: ActiveSessionDTO, simulate?: SimMode) => {
    setMark(session.id, { kind: "locating" });
    try {
      let lat: number, lng: number, accuracy: number;
      if (simulate) {
        const meters = simulate === "door" ? 2 : simulate === "near" ? 15 : 45;
        const fix = simulateGpsFix(session.lat, session.lng, meters);
        lat = fix.lat; lng = fix.lng; accuracy = fix.accuracy;
        await new Promise((r) => setTimeout(r, 1400)); // let the radar feel real
      } else {
        const pos = await getPosition();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
      }

      const { data } = await post<{ ok: true; message: string; distance: number } | { ok: false; message: string }>(
        "/api/attendance",
        { sessionId: session.id, lat, lng, accuracy },
      );

      if (data.ok) {
        setMark(session.id, { kind: "success", message: data.message, distance: data.distance });
        toast.success("Attendance marked — Present!");
      } else {
        setMark(session.id, { kind: "error", message: data.message });
      }
    } catch (e) {
      setMark(session.id, {
        kind: "error",
        message: e instanceof Error ? e.message : "Could not determine your location.",
      });
    } finally {
      loadSessions();
      loadHistory();
    }
  };

  const joinAll = async () => {
    const { data } = await post<{ joined: string[] }>("/api/courses/join", {});
    toast.success(`Joined ${data.joined.length} course${data.joined.length === 1 ? "" : "s"}.`);
    loadCourses();
    loadSessions();
  };

  const joinByCode = async () => {
    if (!joinCode.trim()) return;
    const { status, data } = await post<{ joined: string[]; error?: string }>("/api/courses/join", { code: joinCode });
    if (status === 200) {
      toast.success(`Joined ${data.joined[0]}.`);
      setJoinCode("");
      loadCourses();
      loadSessions();
    } else {
      toast.error(data.error ?? "Could not join that course.");
    }
  };

  const logout = async () => {
    await post("/api/auth/logout");
    onLogout();
  };

  // overall attendance %
  const held = courses?.reduce((sum, c) => sum + c.sessionsHeld, 0) ?? 0;
  const attended = history?.length ?? 0;
  const overallPct = held > 0 ? Math.round((attended / held) * 100) : 0;

  // group history by date
  const grouped = (() => {
    if (!history) return [];
    const map = new Map<string, HistoryRow[]>();
    for (const row of history) {
      const key = new Date(row.date).toLocaleDateString("en-CA");
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  })();

  return (
    <main className="min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onOpenDatabase} className="gap-2 px-2" title="Inspect the live database">
              <Database className="h-4 w-4 text-faint" />
              <span className="hidden text-sm sm:inline">Database</span>
            </Button>
            <Badge variant="outline" className="hidden sm:inline-flex">
              <GraduationCap className="h-3 w-3" /> Student
            </Badge>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-2 px-2">
              <Avatar className="h-7 w-7 rounded-[6px]">
                <AvatarFallback className="rounded-[6px]">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{user.name}</span>
              <LogOut className="h-4 w-4 text-faint" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        {/* ── Overview spec strip (hairline-divided) ── */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
          <div className="bg-card p-4">
            <div className="eyebrow">Attendance</div>
            <div className={cn(
              "mt-1.5 font-display tabular-nums text-[28px] leading-none",
              overallPct < 75 && held > 0 ? "text-clay" : "text-ink",
            )}>
              {held > 0 ? `${overallPct}%` : "—"}
            </div>
            <div className="mt-2 text-xs text-muted">of {held} sessions</div>
          </div>
          <div className="bg-card p-4">
            <div className="eyebrow">Present</div>
            <div className="mt-1.5 font-display tabular-nums text-[28px] leading-none text-ink">
              {attended}
            </div>
            <div className="mt-2 text-xs text-muted">marks recorded</div>
          </div>
          <div className="bg-card p-4">
            <div className="eyebrow">Courses</div>
            <div className="mt-1.5 font-display tabular-nums text-[28px] leading-none text-ink">
              {courses?.length ?? "—"}
            </div>
            <div className="mt-2 text-xs text-muted">enrolled</div>
          </div>
        </div>
        {held > 0 && overallPct < 75 && (
          <p className="mt-2.5 flex items-center gap-2 px-1 text-xs text-clay">
            <span className="h-1.5 w-1.5 rounded-full bg-clay" />
            You are below the 75% attendance floor — check your schedule.
          </p>
        )}

        <Tabs defaultValue="live" className="mt-7">
          <TabsList>
            <TabsTrigger value="live">Live sessions</TabsTrigger>
            <TabsTrigger value="history">My history</TabsTrigger>
          </TabsList>

          {/* ── Live sessions ── */}
          <TabsContent value="live" className="space-y-4">
            {!sessions ? (
              <Skeleton className="h-44 w-full" />
            ) : sessions.length === 0 ? (
              <Card>
                <CardContent className="grid place-items-center py-12 text-center">
                  <div>
                    <p className="font-display text-xl text-ink">No live sessions right now</p>
                    <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
                      When your teacher opens a session, it appears here with a ten-minute
                      countdown and a check-in button.
                    </p>
                    {courses?.length === 0 && (
                      <div className="mt-5 space-y-2.5">
                        <Button onClick={joinAll}>
                          <UserPlus /> Join demo courses
                        </Button>
                        <p className="text-xs text-faint">…or join with a course code below</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence initial={false}>
                {sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    now={now}
                    markState={marks[s.id] ?? { kind: "idle" }}
                    onMark={(sim) => mark(s, sim)}
                  />
                ))}
              </AnimatePresence>
            )}

            {/* join by code */}
            <div className="flex flex-col gap-2.5 rounded-lg border border-dashed border-line-strong px-4 py-3.5 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 text-sm text-ink-soft">
                <KeyRound className="h-4 w-4 text-faint" />
                Join a course by code
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="CS-101"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="h-9 w-36 font-mono"
                />
                <Button variant="secondary" size="sm" onClick={joinByCode} className="h-9">
                  Join
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history" className="space-y-5">
            {!history ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : history.length === 0 ? (
              <Card>
                <CardContent className="grid place-items-center py-12 text-center">
                  <div>
                    <p className="font-display text-xl text-ink">No attendance yet</p>
                    <p className="mt-1.5 text-sm text-muted">
                      Your marked sessions will appear here, newest first.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              grouped.map(([date, rows]) => (
                <div key={date}>
                  <div className="mb-2 flex items-center gap-3 px-0.5">
                    <span className="eyebrow">
                      {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                        weekday: "long", month: "short", day: "numeric",
                      })}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
                    {rows.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-leaf/25 bg-leaf-tint">
                          <Check className="h-4 w-4 text-leaf-deep" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">
                            <span className="font-mono text-[13px] text-ink-soft">{r.courseCode}</span>
                            {" · "}{r.courseName}
                          </div>
                          <div className="font-mono text-[11px] text-muted">
                            Marked {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" · "}{r.distance.toFixed(1)} m from classroom
                          </div>
                        </div>
                        <Badge>{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <footer className="pb-8 pt-4 text-center text-xs text-faint">
        GeoMark · your attendance, verified by GPS
      </footer>
    </main>
  );
}

// ── Live session card ───────────────────────────────────────

function SessionCard({
  session, now, markState, onMark,
}: {
  session: ActiveSessionDTO;
  now: number;
  markState: MarkState;
  onMark: (sim?: SimMode) => void;
}) {
  const remaining = new Date(session.endTime).getTime() - now;
  const totalMs = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
  const expired = remaining <= 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
    >
      <Card className={cn(session.markedByMe && "border-leaf/40")}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge><span className="live-dot" /> Live</Badge>
                <span className="font-mono text-xs text-muted">{session.courseCode}</span>
              </div>
              <h3 className="mt-2.5 truncate font-display text-[26px] leading-tight text-ink">
                {session.courseName}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {session.teacherName} · {session.presentCount} present
              </p>
            </div>
            {!expired ? (
              <CountdownRing
                remainingMs={remaining}
                totalMs={totalMs}
                label={formatCountdown(session.endTime, now)}
                sublabel="left"
                size={86}
              />
            ) : (
              <Badge variant="secondary"><Timer className="h-3 w-3" /> Closed</Badge>
            )}
          </div>

          {/* marked state */}
          {session.markedByMe ? (
            <div className="pop-in mt-5 flex items-center gap-3 rounded-md border border-line border-l-[3px] border-l-leaf bg-leaf-tint px-4 py-3.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-leaf-deep" />
              <div>
                <div className="text-sm font-semibold text-ink">Present — you&apos;re checked in</div>
                <div className="font-mono text-xs text-ink-soft">
                  Recorded {session.myDistance?.toFixed(1)} m from the classroom.
                </div>
              </div>
            </div>
          ) : expired ? (
            <div className="mt-5 flex items-center gap-3 rounded-md border border-line bg-paper-deep px-4 py-3.5 text-sm text-muted">
              <Timer className="h-4.5 w-4.5 shrink-0 text-faint" />
              This session has ended — attendance is locked.
            </div>
          ) : (
            <>
              {/* action row */}
              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={markState.kind === "locating"}
                  onClick={() => onMark()}
                >
                  {markState.kind === "locating" ? (
                    <>
                      <div className="radar h-5 w-5">
                        <span /><span /><span />
                      </div>
                      Locating…
                    </>
                  ) : (
                    <>
                      <MapPin /> Mark attendance
                    </>
                  )}
                </Button>
                <DemoSimPopover disabled={markState.kind === "locating"} onPick={onMark} />
              </div>

              {/* result banner */}
              <AnimatePresence mode="wait">
                {markState.kind === "locating" && (
                  <motion.div
                    key="locating"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex items-center gap-3 rounded-md border border-line bg-paper-deep px-4 py-3 text-sm text-ink-soft">
                      <Loader2 className="h-4 w-4 animate-spin text-muted" />
                      Reading your GPS position — needs ±20 m accuracy…
                    </div>
                  </motion.div>
                )}
                {markState.kind === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pop-in mt-3 flex items-center gap-3 rounded-md border border-line border-l-[3px] border-l-leaf bg-leaf-tint px-4 py-3.5">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-leaf-deep" />
                      <div className="text-sm">
                        <span className="font-display text-lg text-ink">Present!</span>{" "}
                        <span className="text-ink-soft">{markState.message}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                {markState.kind === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pop-in mt-3 flex items-start gap-3 rounded-md border border-line border-l-[3px] border-l-clay bg-clay-tint px-4 py-3.5">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-clay" />
                      <p className="text-sm leading-relaxed text-ink">{markState.message}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Demo GPS simulator popover ──────────────────────────────

function DemoSimPopover({
  disabled, onPick,
}: {
  disabled: boolean;
  onPick: (sim: SimMode) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="lg" className="sm:w-auto" disabled={disabled}>
          <FlaskConical /> Demo GPS
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="eyebrow mb-1">Demo location simulator</div>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Can&apos;t physically be in class? Simulate a GPS position relative to the
          classroom. The server still runs the full Haversine + accuracy pipeline.
        </p>
        <div className="divide-y divide-line rounded-md border border-line">
          {(Object.keys(SIM_LABELS) as SimMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setOpen(false);
                onPick(mode);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors cursor-pointer first:rounded-t-md last:rounded-b-md",
                mode === "far"
                  ? "text-clay hover:bg-clay-tint"
                  : "text-ink hover:bg-leaf-tint",
              )}
            >
              <span className="font-medium">{SIM_LABELS[mode].label}</span>
              <span className="font-mono text-[11px] text-muted">{SIM_LABELS[mode].hint}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
