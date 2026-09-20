"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Radar, LogOut, MapPin, Navigation, CheckCircle2, XCircle, Timer,
  History, Radio, Loader2, FlaskConical, UserPlus, KeyRound, CalendarDays,
  Ruler, GraduationCap,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { CountdownRing } from "@/components/countdown-ring";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

export function StudentDashboard({ user, onLogout }: { user: SafeUser; onLogout: () => void }) {
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
    <main className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/6 bg-[#06080b]/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              <GraduationCap className="h-3 w-3" /> Student
            </Badge>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{user.name}</span>
              <LogOut className="h-4 w-4 text-zinc-500" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        {/* ── Overview stats ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-2xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Attendance</div>
            <div className={cn(
              "mt-1.5 font-display text-2xl font-bold",
              overallPct < 75 && held > 0 ? "text-rose-400" : "text-gradient",
            )}>
              {held > 0 ? `${overallPct}%` : "—"}
            </div>
            <Progress
              value={overallPct}
              className="mt-2 h-1.5"
              indicatorClassName={overallPct < 75 && held > 0 ? "bg-gradient-to-r from-rose-500 to-rose-400" : undefined}
            />
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Present</div>
            <div className="mt-1.5 font-display text-2xl font-bold text-zinc-50">{attended}</div>
            <div className="mt-2 text-xs text-zinc-500">of {held} sessions</div>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Courses</div>
            <div className="mt-1.5 font-display text-2xl font-bold text-zinc-50">{courses?.length ?? "—"}</div>
            <div className="mt-2 text-xs text-zinc-500">enrolled</div>
          </div>
        </div>

        <Tabs defaultValue="live" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="live">
              <Radio className="h-4 w-4" /> Live sessions
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4" /> My history
            </TabsTrigger>
          </TabsList>

          {/* ── Live sessions ── */}
          <TabsContent value="live" className="space-y-4">
            {!sessions ? (
              <Skeleton className="h-44 w-full" />
            ) : sessions.length === 0 ? (
              <Card>
                <CardContent className="grid place-items-center py-12 text-center">
                  <div>
                    <Radar className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                    <p className="font-medium text-zinc-300">No live sessions right now</p>
                    <p className="mt-1 max-w-sm text-sm text-zinc-500">
                      When your teacher starts a session, it appears here with a 10-minute countdown.
                    </p>
                    {courses?.length === 0 && (
                      <div className="mt-5 space-y-2.5">
                        <Button onClick={joinAll}>
                          <UserPlus /> Join demo courses
                        </Button>
                        <p className="text-xs text-zinc-600">…or join with a course code below</p>
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
            <Card className="border-dashed">
              <CardContent className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2 text-sm text-zinc-400">
                  <KeyRound className="h-4 w-4 text-emerald-300" />
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history" className="space-y-4">
            {!history ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : history.length === 0 ? (
              <Card>
                <CardContent className="grid place-items-center py-12 text-center">
                  <div>
                    <CalendarDays className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                    <p className="font-medium text-zinc-300">No attendance yet</p>
                    <p className="mt-1 text-sm text-zinc-500">Your marked sessions will appear here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              grouped.map(([date, rows]) => (
                <div key={date}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                        weekday: "long", month: "short", day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <div
                        key={r.id}
                        className="glass glass-hover flex items-center gap-3 rounded-xl px-4 py-3"
                      >
                        <div className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-zinc-100">
                            {r.courseCode} · {r.courseName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Marked {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {r.distance.toFixed(1)} m from classroom
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

      <footer className="pb-6 text-center text-xs text-zinc-600">
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
    >
      <Card className={cn("relative overflow-hidden", session.markedByMe && "border-emerald-400/30")}>
        {session.markedByMe && (
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        )}
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge><span className="live-dot" /> LIVE</Badge>
                <span className="font-mono text-xs text-zinc-500">{session.courseCode}</span>
              </div>
              <h3 className="mt-2 truncate font-display text-xl font-bold text-zinc-50">
                {session.courseName}
              </h3>
              <p className="mt-0.5 text-sm text-zinc-500">
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
            <div className="pop-in mt-5 flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/8 px-4 py-3.5">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" />
              <div>
                <div className="font-display font-bold text-emerald-200">Present — you&apos;re checked in</div>
                <div className="text-sm text-emerald-300/70">
                  Recorded {session.myDistance?.toFixed(1)} m from the classroom.
                </div>
              </div>
            </div>
          ) : expired ? (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3.5 text-sm text-zinc-500">
              <Timer className="h-5 w-5 shrink-0 text-zinc-500" />
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
                      <Navigation className="relative z-10 hidden" />
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
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200/90">
                      <Loader2 className="h-4 w-4 animate-spin" />
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
                    <div className="pop-in mt-3 flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3.5">
                      <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" />
                      <div className="text-sm">
                        <span className="font-display text-base font-bold text-emerald-200">Present!</span>{" "}
                        <span className="text-emerald-200/80">{markState.message}</span>
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
                    <div className="pop-in mt-3 flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-400/8 px-4 py-3.5">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
                      <p className="text-sm leading-relaxed text-rose-200/90">{markState.message}</p>
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
        <div className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-zinc-100">
          <Ruler className="h-4 w-4 text-emerald-300" /> Demo location simulator
        </div>
        <p className="mb-3 text-xs leading-relaxed text-zinc-500">
          Can&apos;t physically be in class? Simulate a GPS position relative to the
          classroom. The server still runs the full Haversine + accuracy pipeline.
        </p>
        <div className="space-y-2">
          {(Object.keys(SIM_LABELS) as SimMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setOpen(false);
                onPick(mode);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-all cursor-pointer",
                mode === "far"
                  ? "border-rose-400/25 bg-rose-400/6 text-rose-200 hover:border-rose-400/50"
                  : "border-emerald-400/25 bg-emerald-400/6 text-emerald-100 hover:border-emerald-400/50",
              )}
            >
              <span className="font-medium">{SIM_LABELS[mode].label}</span>
              <span className="text-xs opacity-70">{SIM_LABELS[mode].hint}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
