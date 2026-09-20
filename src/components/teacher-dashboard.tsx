"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Play, Square, Plus, Download, MapPin, Crosshair, Loader2,
  Users, LogOut, Radio,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { CountdownRing } from "@/components/countdown-ring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, post, patch, getPosition, formatCountdown } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { SafeUser } from "@/lib/auth";
import type { CourseDTO, StudentStat, LiveAttendanceRow } from "@/lib/types";

type SessionDetail = {
  session: {
    id: string; courseId: string; courseName: string; courseCode: string;
    status: "ACTIVE" | "ENDED"; startTime: string; endTime: string;
    lat: number; lng: number; radius: number;
    presentCount: number; enrolledCount: number;
  };
  attendance: LiveAttendanceRow[];
  stats: StudentStat[];
};

export function TeacherDashboard({
  user,
  onLogout,
}: {
  user: SafeUser;
  onLogout: () => void;
}) {
  const [courses, setCourses] = useState<CourseDTO[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [now, setNow] = useState(Date.now());
  const [startOpen, setStartOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = useMemo(
    () => courses?.find((c) => c.id === selectedId) ?? null,
    [courses, selectedId],
  );

  const loadCourses = useCallback(async () => {
    const { data } = await api<{ courses: CourseDTO[] }>("/api/courses");
    setCourses(data.courses);
    setSelectedId((prev) => prev ?? data.courses[0]?.id ?? null);
  }, []);

  // initial load
  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // clock tick for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll live session detail every 3 s while the selected course is live;
  // otherwise fetch the most recent session once so roster/feed stay useful.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setDetail(null);
    const id = selected?.activeSessionId ?? selected?.lastSessionId;
    if (!id) return;

    let stopped = false;
    const fetchDetail = async () => {
      const { data } = await api<SessionDetail>(`/api/sessions/${id}`);
      if (stopped || !data.session) return;
      setDetail(data);
      if (data.session.status !== "ACTIVE" && pollRef.current) {
        clearInterval(pollRef.current);
        loadCourses(); // refresh active flags
      }
    };
    fetchDetail();
    pollRef.current = setInterval(fetchDetail, 3000);
    return () => {
      stopped = true;
      clearInterval(pollRef.current!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.activeSessionId, selected?.lastSessionId]);

  const active = detail?.session.status === "ACTIVE" ? detail : null;
  const remaining = active ? new Date(active.session.endTime).getTime() - now : 0;
  const totalMs = active ? new Date(active.session.endTime).getTime() - new Date(active.session.startTime).getTime() : 1;

  const logout = async () => {
    await post("/api/auth/logout");
    onLogout();
  };

  return (
    <main className="min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New course</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <Avatar className="h-7 w-7 rounded-[6px]">
                    <AvatarFallback className="rounded-[6px]">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
                    {user.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {user.name}
                  <div className="mt-0.5 font-mono text-[11px] font-normal normal-case tracking-normal text-muted">
                    {user.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-clay hover:bg-clay-tint">
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {/* ── Course selector ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {!courses ? (
            <>
              <Skeleton className="h-10 w-44" />
              <Skeleton className="h-10 w-44" />
            </>
          ) : courses.length === 0 ? (
            <p className="text-sm text-muted">
              No courses yet — create your first course to start taking attendance.
            </p>
          ) : (
            courses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md border px-3.5 py-2 text-sm transition-colors cursor-pointer",
                  c.id === selectedId
                    ? "border-ink bg-ink text-paper"
                    : "border-line-strong bg-card text-ink-soft hover:border-ink/45 hover:text-ink",
                )}
              >
                {c.activeSessionId && <span className="live-dot" />}
                <span className="font-mono text-[13px]">{c.code}</span>
                <span className="hidden text-xs opacity-70 md:inline">{c.name}</span>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* ── Session control ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Attendance session</span>
                  {active ? (
                    <Badge><span className="live-dot" /> Live</Badge>
                  ) : (
                    <Badge variant="secondary">Offline</Badge>
                  )}
                </div>
                <CardTitle className="mt-1 font-display text-[22px] font-normal">
                  {selected.code} <span className="text-faint">·</span>{" "}
                  <span className="text-ink-soft">{selected.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
                {active ? (
                  <>
                    <CountdownRing
                      remainingMs={remaining}
                      totalMs={totalMs}
                      label={formatCountdown(active.session.endTime, now)}
                      sublabel={remaining > 0 ? "auto-closes" : "closing…"}
                    />
                    <div className="w-full space-y-3 sm:w-auto">
                      <dl className="space-y-2.5 border-l border-line pl-4 text-sm">
                        <div>
                          <dt className="eyebrow">Geofence center</dt>
                          <dd className="mt-0.5 font-mono text-[13px] text-ink">
                            {active.session.lat.toFixed(5)}, {active.session.lng.toFixed(5)}
                          </dd>
                        </div>
                        <div>
                          <dt className="eyebrow">Rules</dt>
                          <dd className="mt-0.5 text-[13px] text-ink-soft">
                            ±{active.session.radius} m radius · GPS must be within ±20 m
                          </dd>
                        </div>
                      </dl>
                      <Button
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          await patch(`/api/sessions/${active.session.id}`);
                          toast.success("Session ended — attendance locked.");
                          loadCourses();
                        }}
                      >
                        <Square /> End session
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex w-full flex-col items-center gap-4 py-2 sm:flex-row sm:justify-between">
                    <div className="text-center sm:text-left">
                      <div className="font-display text-xl text-ink">
                        Ready to take the roll?
                      </div>
                      <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
                        Opens a 10-minute GPS window. Students must be within 30 m of your
                        classroom to check in.
                      </p>
                    </div>
                    <Button size="lg" onClick={() => setStartOpen(true)}>
                      <Play /> Start attendance
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Spec-sheet stat cells (hairline-divided) ── */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
              <StatCell
                label={active ? "Present now" : "Last session"}
                value={detail ? `${detail.session.presentCount}` : "—"}
                sub={`of ${selected.enrolledCount} enrolled`}
                emphasize
              />
              <StatCell
                label="Live rate"
                value={
                  detail && selected.enrolledCount
                    ? `${Math.round((detail.session.presentCount / selected.enrolledCount) * 100)}%`
                    : "—"
                }
                sub="this session"
              />
              <StatCell
                label="Sessions held"
                value={`${selected.sessionsHeld}`}
                sub="all time"
              />
              <div className="flex flex-col justify-between gap-3 bg-card p-4">
                <span className="eyebrow">Report</span>
                <Button variant="secondary" size="sm" className="w-full" asChild>
                  <a href={`/api/courses/${selected.id}/report`} download>
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </a>
                </Button>
              </div>
            </div>

            {/* ── Live feed ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-leaf" /> Live check-ins
                  </span>
                  {active && (
                    <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-muted">
                      <span className="live-dot" /> updating
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto">
                {!detail ? (
                  <div className="space-y-3">
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                ) : detail.attendance.length === 0 ? (
                  <div className="grid place-items-center rounded-md border border-dashed border-line-strong py-10 text-center">
                    <div>
                      <Crosshair className="mx-auto mb-2 h-5 w-5 text-faint" />
                      <p className="text-sm text-ink-soft">Waiting for the first check-in…</p>
                      <p className="mt-1 text-xs text-faint">
                        Students who mark attendance appear here instantly.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    <AnimatePresence initial={false}>
                      {detail.attendance.map((a) => (
                        <motion.li
                          key={a.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 py-2.5"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {a.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-ink">{a.name}</div>
                            <div className="font-mono text-[11px] text-muted">
                              {new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {" · "}±{a.accuracy.toFixed(0)} m accuracy
                            </div>
                          </div>
                          <span className="font-mono text-[13px] text-ink-soft">
                            {a.distance.toFixed(1)} m
                          </span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* ── Roster % ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-leaf" /> Course roster · attendance
                </CardTitle>
                <CardDescription>Below 75% is flagged automatically.</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 space-y-3.5 overflow-y-auto">
                {!detail ? (
                  <>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : (
                  detail.stats.map((s) => (
                    <RosterRow key={s.studentId} stat={s} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Start-session dialog ── */}
      {selected && (
        <StartSessionDialog
          open={startOpen}
          onOpenChange={setStartOpen}
          course={selected}
          onStarted={() => {
            setStartOpen(false);
            loadCourses();
          }}
        />
      )}

      {/* ── Create-course dialog ── */}
      <CreateCourseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          loadCourses();
        }}
      />

      <footer className="pb-8 pt-4 text-center text-xs text-faint">
        GeoMark teacher console · attendance verified by GPS
      </footer>
    </main>
  );
}

// ── Subcomponents ───────────────────────────────────────────

function StatCell({
  label, value, sub, emphasize,
}: {
  label: string;
  value: string;
  sub: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 bg-card p-4">
      <span className="eyebrow">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-display tabular-nums text-ink",
            emphasize ? "text-[34px]" : "text-[28px]",
          )}
        >
          {value}
        </span>
        <span className="text-xs text-muted">{sub}</span>
      </div>
    </div>
  );
}

function RosterRow({ stat }: { stat: StudentStat }) {
  const low = stat.percent < 75;
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-[10px]">
          {stat.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-ink">{stat.name}</span>
          <span className={cn("font-mono text-xs tabular-nums", low ? "text-clay" : "text-leaf-deep")}>
            {stat.percent}%
          </span>
        </div>
        <Progress
          value={stat.percent}
          indicatorClassName={low ? "bg-clay" : undefined}
        />
      </div>
      {low && <Badge variant="danger" className="hidden sm:inline-flex">Low</Badge>}
    </div>
  );
}

function StartSessionDialog({
  open, onOpenChange, course, onStarted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  course: CourseDTO;
  onStarted: () => void;
}) {
  const [lat, setLat] = useState(course.lastLat?.toString() ?? "");
  const [lng, setLng] = useState(course.lastLng?.toString() ?? "");
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (open) {
      setLat(course.lastLat?.toString() ?? "");
      setLng(course.lastLng?.toString() ?? "");
    }
  }, [open, course]);

  const capture = async () => {
    setCapturing(true);
    try {
      const pos = await getPosition();
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
      toast.success(`Location captured (±${Math.round(pos.coords.accuracy)} m accuracy).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read location.");
    } finally {
      setCapturing(false);
    }
  };

  const start = async () => {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      toast.error("Classroom coordinates are required.");
      return;
    }
    const { status, data } = await post<{ session?: unknown; error?: string }>("/api/sessions", {
      courseId: course.id,
      lat: la,
      lng: ln,
      radius: 30,
    });
    if (status === 200) {
      toast.success(`Session live for ${course.code} — closes automatically in 10 minutes.`);
      onStarted();
    } else {
      toast.error(data.error ?? "Failed to start session.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Start session <span className="font-mono text-[15px] text-muted">{course.code}</span>
          </DialogTitle>
          <DialogDescription>
            Set the classroom geofence center. Students within a 30 m radius may check in for
            the next 10 minutes.
          </DialogDescription>
        </DialogHeader>

        {/* geofence preview — paper well, dashed fence */}
        <div className="mb-5 grid place-items-center rounded-md border border-line bg-paper-deep py-6">
          <div className="relative grid h-28 w-28 place-items-center">
            <div className="absolute inset-0 rounded-full border border-dashed border-ink/35" />
            <div className="h-2 w-2 rounded-full bg-leaf" />
            <span className="absolute -bottom-1 bg-paper-deep px-2 py-0.5 font-mono text-[10px] text-ink-soft">
              30 m radius
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <Button variant="secondary" className="w-full" onClick={capture} disabled={capturing}>
            {capturing ? <Loader2 className="animate-spin" /> : <MapPin />}
            {capturing ? "Reading GPS…" : "Use my current location"}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lat">Latitude</Label>
              <Input id="lat" inputMode="decimal" placeholder="28.5462" value={lat} onChange={(e) => setLat(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lng">Longitude</Label>
              <Input id="lng" inputMode="decimal" placeholder="77.1930" value={lng} onChange={(e) => setLng(e.target.value)} className="font-mono" />
            </div>
          </div>
          <Button size="lg" className="w-full" onClick={start}>
            <Play /> Start 10-minute session
          </Button>
          <p className="text-center text-xs text-faint">
            Coordinates default to your last classroom location for this course.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateCourseDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const { status, data } = await post<{ error?: string }>("/api/courses", { name, code });
    setBusy(false);
    if (status === 200) {
      toast.success(`Course ${code.toUpperCase()} created.`);
      setName(""); setCode("");
      onCreated();
    } else {
      toast.error(data.error ?? "Failed to create course.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create course</DialogTitle>
          <DialogDescription>Students join with the course code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Course name</Label>
            <Input id="cname" placeholder="Operating Systems" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ccode">Course code</Label>
            <Input id="ccode" placeholder="CS-301" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
          </div>
          <Button size="lg" className="w-full" onClick={create} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Create course
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
