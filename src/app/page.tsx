"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/logo";
import { Landing } from "@/components/landing";
import { TeacherDashboard } from "@/components/teacher-dashboard";
import { StudentDashboard } from "@/components/student-dashboard";
import { api } from "@/lib/client";
import type { SafeUser } from "@/lib/auth";

type View = "loading" | "guest" | "teacher" | "student";

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [user, setUser] = useState<SafeUser | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await api<{ user: SafeUser | null }>("/api/auth/me");
      if (data.user) {
        setUser(data.user);
        setView(data.user.role === "TEACHER" ? "teacher" : "student");
      } else {
        setView("guest");
      }
    })();
  }, []);

  const handleAuthed = (u: SafeUser) => {
    setUser(u);
    setView(u.role === "TEACHER" ? "teacher" : "student");
  };

  const handleLogout = () => {
    setUser(null);
    setView("guest");
  };

  return (
    <>
      {/* ── Splash ── */}
      <AnimatePresence>
        {view === "loading" && (
          <motion.div
            key="splash"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#06080b]"
          >
            <div className="flex flex-col items-center gap-5">
              <div className="radar h-16 w-16">
                <span /><span /><span />
              </div>
              <div className="relative z-10">
                <Logo size="lg" withWordmark={false} />
              </div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-600">
                Locating your session
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {view === "guest" && <Landing onAuthed={handleAuthed} />}
      {view === "teacher" && user && (
        <motion.div
          key="teacher"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <TeacherDashboard user={user} onLogout={handleLogout} />
        </motion.div>
      )}
      {view === "student" && user && (
        <motion.div
          key="student"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <StudentDashboard user={user} onLogout={handleLogout} />
        </motion.div>
      )}
    </>
  );
}
