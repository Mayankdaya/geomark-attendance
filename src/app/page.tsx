"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/logo";
import { Landing } from "@/components/landing";
import { TeacherDashboard } from "@/components/teacher-dashboard";
import { StudentDashboard } from "@/components/student-dashboard";
import { DatabaseView } from "@/components/database-view";
import { api } from "@/lib/client";
import type { SafeUser } from "@/lib/auth";

type View = "loading" | "guest" | "teacher" | "student" | "database";

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [returnView, setReturnView] = useState<Exclude<View, "database">>("guest");
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

  // Jump to the database inspector from any view, remembering where to return.
  const openDatabase = () => {
    if (view !== "database") setReturnView(view === "loading" ? "guest" : view);
    setView("database");
  };
  const backFromDatabase = () => setView(returnView);

  return (
    <>
      {/* ── Splash ── */}
      <AnimatePresence>
        {view === "loading" && (
          <motion.div
            key="splash"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 grid place-items-center bg-paper"
          >
            <div className="flex flex-col items-center gap-5">
              <div className="radar h-16 w-16">
                <span /><span /><span />
              </div>
              <div className="relative z-10">
                <Logo size="lg" withWordmark={false} />
              </div>
              <p className="eyebrow">Locating your session</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {view === "guest" && <Landing onAuthed={handleAuthed} onOpenDatabase={openDatabase} />}
      {view === "teacher" && user && (
        <motion.div
          key="teacher"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <TeacherDashboard user={user} onLogout={handleLogout} onOpenDatabase={openDatabase} />
        </motion.div>
      )}
      {view === "student" && user && (
        <motion.div
          key="student"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <StudentDashboard user={user} onLogout={handleLogout} onOpenDatabase={openDatabase} />
        </motion.div>
      )}
      {view === "database" && (
        <motion.div
          key="database"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <DatabaseView onBack={backFromDatabase} />
        </motion.div>
      )}
    </>
  );
}
