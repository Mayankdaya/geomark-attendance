"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Play, Square, Plus, Download, MapPin, Crosshair, Loader2,
  Users, UserCheck, Percent, Radio, ShieldCheck, FileText, LogOut,
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
    <main className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/6 bg-[#06080b]/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New course</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
                    {user.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {user.name}
                  <div className="text-[11px] font-normal text-zinc-500">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-rose-300 hover:bg-rose-400/10">
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* ── Course selector ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {!courses ? (
            <>
              <Skeleton className="h-10 w-44" />
              <Skeleton className="h-10 w-44" />
            </>
          ) : courses.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No courses yet — create your first course to start taking attendance.
            </p>
          ) : (
            courses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                  c.id === selectedId
                    ? "border-emerald-400/60 bg-emerald-400/12 text-emerald-100 shadow-[0_0_28px_-8px_rgba(16,185,129,0.55)]"
                    : "border-white/10 bg-white/4 text-zinc-400 hover:border-white/25 hover:text-zinc-200",
                )}
              >
                {c.activeSessionId && <span className="live-dot" />}
                <span className="font-display">{c.code}</span>
                <span className="hidden text-xs font-normal opacity-70 md:inline">{c.name}</span>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* ── Session control ── */}
            <Card className="relative overflow-hidden">
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-emerald-300" /> Attendance session
                  </CardTitle>
                  {active ? (
                    <Badge><span className="live-dot" /> LIVE</Badge>
                  ) : (
                    <Badge variant="secondary">OFFLINE</Badge>
                  )}
                </div>
                <CardDescription>
                  {selected.code} · {selected.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
                {active ? (
                  <>
                    <CountdownRing
                      remainingMs={remaining}
                      totalMs={totalMs}
                      label={formatCountdown(active.session.endTime, now)}
                      sublabel={remaining > 0 ? "auto-closes" : "closing…"}
                    />
                    <div className="w-full space-y-3 sm:w-auto">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <MapPin className="h-4 w-4 text-emerald-300" />
                        <span className="font-mono text-xs">
                          {active.session.lat.toFixed(5)}, {active.session.lng.toFixed(5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <ShieldCheck className="h-4 w-4 text-emerald-300" />
                        Geofence ±{active.session.radius} m · ±20 m accuracy gate
                      </div>
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
                      <div className="font-display text-lg font-semibold text-zinc-100">
                        Ready to roll call?
                      </div>
                      <p className="mt-1 max-w-xs text-sm text-zinc-400">
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

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
              <StatCard
                icon={UserCheck}
                label={active ? "Present now" : "Last session"}
                value={detail ? `${detail.session.presentCount}` : "—"}
                sub={`of ${selected.enrolledCount} enrolled`}
                accent
              />
              <StatCard
                icon={Percent}
                label="Live rate"
                value={
                  detail && selected.enrolledCount
                    ? `${Math.round((detail.session.presentCount / selected.enrolledCount) * 100)}%`
                    : "—"
                }
                sub="this session"
              />
              <StatCard
                icon={FileText}
                label="Sessions held"
                value={`${selected.sessionsHeld}`}
                sub="all time"
              />
              <div className="glass glass-hover flex flex-col justify-between rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  <Download className="h-4 w-4 text-emerald-300" /> Report
                </div>
                <div className="mt-3">
                  <Button variant="secondary" size="sm" className="w-full" asChild>
                    <a href={`/api/courses/${selected.id}/report`} download>
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Live feed ── */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-300" /> Live check-ins
                  </span>
                  {active && <Badge><span className="live-dot" /> updating</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 space-y-2 overflow-y-auto">
                {!detail ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : detail.attendance.length === 0 ? (
                  <div className="grid place-items-center rounded-xl border border-dashed border-white/10 py-10 text-center">
                    <div>
                      <Crosshair className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
                      <p className="text-sm text-zinc-500">Waiting for the first check-in…</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Students who mark attendance appear here instantly.
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {detail.attendance.map((a) => (
                      <motion.div
                        key={a.id}
                        layout
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/3 px-3 py-2.5"
                      >
                        <Avatar>
                          <AvatarFallback>
                            {a.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-zinc-100">{a.name}</div>
                          <div className="text-xs text-zinc-500">
                            {new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · GPS ±{a.accuracy.toFixed(0)} m
                          </div>
                        </div>
                        <Badge variant="secondary" className="font-mono">
                          {a.distance.toFixed(1)} m
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </CardContent>
            </Card>

            {/* ── Roster % ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-emerald-300" /> Course roster · attendance %
                </CardTitle>
                <CardDescription>Below 75% is flagged automatically.</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 space-y-3 overflow-y-auto">
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

      <footer className="pb-6 text-center text-xs text-zinc-600">
        GeoMark teacher console · live GPS attendance
      </footer>
    </main>
  );
}

// ── Subcomponents ───────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="glass glass-hover flex flex-col justify-between rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <Icon className={cn("h-4 w-4", accent ? "text-emerald-300" : "text-zinc-400")} />
        {label}
      </div>
      <div className="mt-3">
        <span className={cn("font-display text-3xl font-bold", accent ? "text-gradient" : "text-zinc-50")}>
          {value}
        </span>
        <span className="ml-1.5 text-xs text-zinc-500">{sub}</span>
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
          <span className="truncate text-sm font-medium text-zinc-200">{stat.name}</span>
          <span className={cn("text-xs font-bold tabular-nums", low ? "text-rose-400" : "text-emerald-300")}>
            {stat.percent}%
          </span>
        </div>
        <Progress
          value={stat.percent}
          className={cn("h-1.5", low && "bg-rose-400/10")}
          indicatorClassName={low ? "bg-gradient-to-r from-rose-500 to-rose-400" : undefined}
        />
      </div>
      {low && <Badge variant="danger" className="hidden sm:inline-flex">LOW</Badge>}
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
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-300" /> Start session · {course.code}
          </DialogTitle>
          <DialogDescription>
            Set the classroom geofence center. Students within a 30 m radius may check in for
            the next 10 minutes.
          </DialogDescription>
        </DialogHeader>

        {/* geofence preview */}
        <div className="mb-4 grid place-items-center rounded-xl border border-white/8 bg-white/3 py-5">
          <div className="relative grid h-28 w-28 place-items-center">
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-400/40 bg-emerald-400/5" />
            <div className="absolute inset-6 rounded-full bg-emerald-400/10" />
            <Crosshair className="h-6 w-6 text-emerald-300" />
            <span className="absolute -bottom-1 rounded-full border border-emerald-400/30 bg-[#0b0f14] px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              30 m radius
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <Button variant="secondary" className="w-full" onClick={capture} disabled={capturing}>
            {capturing ? <Loader2 className="animate-spin" /> : <MapPin />}
            {capturing ? "Reading GPS…" : "Use my current location"}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lat">Latitude</Label>
              <Input id="lat" inputMode="decimal" placeholder="28.5462" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lng">Longitude</Label>
              <Input id="lng" inputMode="decimal" placeholder="77.1930" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
          <Button size="lg" className="w-full" onClick={start}>
            <Play /> Start 10-minute session
          </Button>
          <p className="text-center text-xs text-zinc-600">
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
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-300" /> Create course
          </DialogTitle>
          <DialogDescription>Students join with the course code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Course name</Label>
            <Input id="cname" placeholder="Operating Systems" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ccode">Course code</Label>
            <Input id="ccode" placeholder="CS-301" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>
          <Button size="lg" className="w-full" onClick={create} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Create course
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
