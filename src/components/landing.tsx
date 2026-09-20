"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight, Loader2, GraduationCap, Users, MapPin, Database,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { post } from "@/lib/client";
import type { SafeUser } from "@/lib/auth";

/** Numbered ledger rows instead of icon cards — feels like a spec sheet, not a template. */
const FEATURES = [
  {
    n: "01",
    title: "A 30-meter geofence around the room",
    desc: "Haversine distance is computed against the classroom's coordinates, so check-ins only count from inside the room — not the parking lot.",
  },
  {
    n: "02",
    title: "Ten-minute sessions that close themselves",
    desc: "The teacher opens a window; it shuts automatically when the timer runs out. Late means absent, without an argument.",
  },
  {
    n: "03",
    title: "Every record keeps its evidence",
    desc: "GPS fixes weaker than ±20 m are rejected outright, and each accepted mark stores the exact distance and timestamp it was taken.",
  },
];

const PROOF = [
  { stat: "30 m", label: "geofence radius" },
  { stat: "±20 m", label: "accuracy gate" },
  { stat: "10 min", label: "session window" },
  { stat: "75%", label: "attendance floor" },
];

export function Landing({
  onAuthed,
  onOpenDatabase,
}: {
  onAuthed: (user: SafeUser) => void;
  onOpenDatabase: () => void;
}) {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <Badge variant="outline" className="hidden sm:inline-flex">
          <span className="live-dot" /> Live geofenced roll call
        </Badge>
      </header>

      <div className="mx-auto grid w-full max-w-5xl items-start gap-12 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.1fr_minmax(380px,0.9fr)] lg:gap-16 lg:pt-14">
        {/* ── Editorial column ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-ink/40" />
            <span className="eyebrow">GPS-verified attendance</span>
          </div>

          <h1 className="mt-5 font-display text-[2.6rem] leading-[1.06] tracking-[-0.01em] text-ink sm:text-6xl">
            Roll call that knows
            <br />
            where you <em className="italic">actually</em> are.
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft sm:text-base">
            GeoMark replaces the clipboard with GPS proof. Teachers open a ten-minute
            session from the front of the room; students can only sign in from inside
            its 30-meter geofence. Attendance updates live, and every record carries
            the distance it was marked from.
          </p>

          <ol className="mt-10 divide-y divide-line border-y border-line">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.n}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.1, duration: 0.45 }}
                className="flex gap-5 py-4"
              >
                <span className="pt-1 font-mono text-xs text-faint">{f.n}</span>
                <div>
                  <div className="text-[15px] font-medium text-ink">{f.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{f.desc}</p>
                </div>
              </motion.li>
            ))}
          </ol>

          {/* Spec-sheet strip — hairline-divided cells, mono figures */}
          <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-card sm:grid-cols-4 sm:divide-x divide-line">
            {PROOF.map((p) => (
              <div key={p.label} className="px-4 py-3.5">
                <dd className="font-mono text-[15px] text-ink">{p.stat}</dd>
                <dt className="mt-1 text-[11px] uppercase tracking-[0.1em] text-faint">
                  {p.label}
                </dt>
              </div>
            ))}
          </dl>
        </motion.section>

        {/* ── Auth card ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
        >
          <Card className="mx-auto w-full max-w-md shadow-[0_16px_40px_-20px_rgba(29,26,22,0.25)]">
            <CardContent className="p-6 sm:p-7">
              <AuthCard onAuthed={onAuthed} />
            </CardContent>
          </Card>

          <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-1.5 text-center text-xs text-faint">
            <MapPin className="h-3 w-3" />
            Works on any phone with location services — nothing to install.
          </p>
        </motion.section>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-faint sm:flex-row sm:px-8">
          <span>
            GeoMark <span className="mx-1 text-line-strong">·</span> Haversine-verified presence
          </span>
          <button
            type="button"
            onClick={onOpenDatabase}
            className="inline-flex cursor-pointer items-center gap-1.5 text-ink-soft transition-colors hover:text-ink"
          >
            <Database className="h-3.5 w-3.5" />
            Inspect the live database
          </button>
        </div>
      </footer>
    </main>
  );
}

// ── Auth forms ──────────────────────────────────────────────

function AuthCard({ onAuthed }: { onAuthed: (user: SafeUser) => void }) {
  return (
    <Tabs defaultValue="login">
      <TabsList>
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
    <form onSubmit={submit} className="mt-6 space-y-4">
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

      <div className="pt-4">
        <p className="eyebrow text-center">Try the demo</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Button type="button" variant="secondary" size="sm" onClick={() => fillDemo("TEACHER")}>
            <Users className="h-3.5 w-3.5" /> Teacher
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => fillDemo("STUDENT")}>
            <GraduationCap className="h-3.5 w-3.5" /> Student
          </Button>
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-faint">
          sarah@campus.edu / teacher123
          <br />
          alex@campus.edu / student123
        </p>
      </div>
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
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <Label>I am a</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {(["STUDENT", "TEACHER"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                role === r
                  ? "border-ink bg-ink text-paper"
                  : "border-line-strong bg-card text-ink-soft hover:border-ink/45 hover:text-ink"
              }`}
            >
              {r === "STUDENT" ? <GraduationCap className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {r === "STUDENT" ? "Student" : "Teacher"}
            </button>
          ))}
        </div>
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
        {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {busy ? "Creating…" : `Create ${role === "STUDENT" ? "student" : "teacher"} account`}
      </Button>
    </form>
  );
}
