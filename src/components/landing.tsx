"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Radar, Timer, ShieldCheck, MapPin, GraduationCap, Users,
  ArrowRight, Loader2, Sparkles, ScanLine, FileDown,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { post } from "@/lib/client";
import type { SafeUser } from "@/lib/auth";

const FEATURES = [
  {
    icon: Radar,
    title: "30 m GPS geofence",
    desc: "Haversine distance check pins students to the physical classroom — no drive-by check-ins.",
  },
  {
    icon: Timer,
    title: "10-minute live sessions",
    desc: "Every session self-destructs after ten minutes. Late? Marked absent. No exceptions.",
  },
  {
    icon: ShieldCheck,
    title: "Anti-proxy engine",
    desc: "Rejects GPS fixes worse than ±20 m, stores the exact distance, and allows one check-in per student.",
  },
];

const PROOF = [
  { icon: ScanLine, stat: "30 m", label: "geofence radius" },
  { icon: MapPin, stat: "±20 m", label: "accuracy gate" },
  { icon: Timer, stat: "10 min", label: "session window" },
  { icon: FileDown, stat: "CSV", label: "one-click reports" },
];

export function Landing({ onAuthed }: { onAuthed: (user: SafeUser) => void }) {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <Badge variant="secondary" className="hidden sm:inline-flex">
          <Sparkles className="h-3 w-3" /> GPS-verified attendance
        </Badge>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.1fr_minmax(400px,0.9fr)] lg:gap-16">
        {/* ── Marketing column ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Badge className="mb-5 px-3 py-1">
            <span className="live-dot" /> Real-time geofenced roll call
          </Badge>
          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-zinc-50 sm:text-5xl lg:text-[3.4rem]">
            Attendance that checks
            <br />
            <span className="text-gradient">where you actually are.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            GeoMark replaces manual roll call with GPS proof. Teachers open a ten-minute
            session; students can only sign in from inside the classroom&apos;s 30-meter
            geofence. Everything updates live, and every record keeps its distance.
          </p>

          <div className="mt-8 space-y-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.5 }}
                className="flex gap-4"
              >
                <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-zinc-100">{f.title}</div>
                  <div className="text-sm leading-relaxed text-zinc-400">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            {PROOF.map((p) => (
              <div key={p.label} className="glass glass-hover rounded-xl px-4 py-3">
                <p.icon className="mb-1.5 h-4 w-4 text-emerald-300/80" />
                <div className="font-display text-lg font-bold text-zinc-50">{p.stat}</div>
                <div className="text-[11px] text-zinc-500">{p.label}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Auth card ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        >
          <Card className="mx-auto w-full max-w-md">
            <CardContent className="p-6 sm:p-7">
              <AuthCard onAuthed={onAuthed} />
            </CardContent>
          </Card>
        </motion.section>
      </div>

      <footer className="pb-6 text-center text-xs text-zinc-600">
        GeoMark · Haversine-verified presence · Built for modern classrooms
      </footer>
    </main>
  );
}

// ── Auth forms ──────────────────────────────────────────────

function AuthCard({ onAuthed }: { onAuthed: (user: SafeUser) => void }) {
  return (
    <Tabs defaultValue="login">
      <TabsList className="w-full">
        <TabsTrigger value="login">Sign in</TabsTrigger>
        <TabsTrigger value="register">Create account</TabsTrigger>
      </TabsList>
      <TabsContent value="login">
        <LoginForm onAuthed={onAuthed} />
      </TabsContent>
      <TabsContent value="register">
        <RegisterForm onAuthed={onAuthed} />
      </TabsContent>
    </Tabs>
  );
}

function LoginForm({ onAuthed }: { onAuthed: (user: SafeUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { status, data } = await post<{ user?: SafeUser; error?: string }>(
      "/api/auth/login",
      { email, password },
    );
    setBusy(false);
    if (status === 200 && data.user) {
      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}`);
      onAuthed(data.user);
    } else {
      toast.error(data.error ?? "Login failed.");
    }
  };

  const fillDemo = (role: "TEACHER" | "STUDENT") => {
    setEmail(role === "TEACHER" ? "sarah@campus.edu" : "alex@campus.edu");
    setPassword(role === "TEACHER" ? "teacher123" : "student123");
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@campus.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {busy ? "Signing in…" : "Sign in"}
      </Button>

      <Separator className="my-5" />
      <p className="text-center text-[11px] uppercase tracking-widest text-zinc-500">
        Try the demo
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="secondary" size="sm" onClick={() => fillDemo("TEACHER")}>
          <Users className="h-3.5 w-3.5" /> Teacher
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => fillDemo("STUDENT")}>
          <GraduationCap className="h-3.5 w-3.5" /> Student
        </Button>
      </div>
      <p className="text-center text-xs text-zinc-600">
        teacher123 / student123 — prefilled from seeded campus data
      </p>
    </form>
  );
}

function RegisterForm({ onAuthed }: { onAuthed: (user: SafeUser) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"TEACHER" | "STUDENT">("STUDENT");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { status, data } = await post<{ user?: SafeUser; error?: string }>(
      "/api/auth/register",
      { name, email, password, role },
    );
    setBusy(false);
    if (status === 200 && data.user) {
      toast.success(`Account created — welcome, ${data.user.name.split(" ")[0]}!`);
      onAuthed(data.user);
    } else {
      toast.error(data.error ?? "Registration failed.");
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        {(["STUDENT", "TEACHER"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-all cursor-pointer ${
              role === r
                ? "border-emerald-400/60 bg-emerald-400/12 text-emerald-200 shadow-[0_0_24px_-6px_rgba(16,185,129,0.5)]"
                : "border-white/10 bg-white/4 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
            }`}
          >
            {r === "STUDENT" ? <GraduationCap className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            {r === "STUDENT" ? "Student" : "Teacher"}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" placeholder="Jamie Rivera" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="remail">Email</Label>
        <Input id="remail" type="email" placeholder="you@campus.edu" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rpassword">Password</Label>
        <Input id="rpassword" type="password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? "Creating…" : `Create ${role === "STUDENT" ? "student" : "teacher"} account`}
      </Button>
    </form>
  );
}
