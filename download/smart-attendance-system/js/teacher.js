/* ==========================================================================
   TEACHER DASHBOARD — js/teacher.js
   --------------------------------------------------------------------------
   Responsibilities:
     1. Page guard (teacher role only)
     2. Course management        — create courses -> Firestore "courses"
     3. Attendance sessions      — Start / Stop / auto-expire (10 minutes)
     4. Live attendance feed     — onSnapshot listener on "attendance"
     5. Attendance % summary     — attended ÷ sessions-held per student
                                   (below 75% flagged red)
     6. CSV exports              — live session log + course summary

   A session document (Firestore "sessions") looks like:
     {
       courseId, courseName, teacherId, teacherName,
       status: "active" | "ended",
       startTime: serverTimestamp,
       endTime:   Timestamp (startTime + 10 min),
       lat, lng,        <- classroom anchor = teacher's GPS at start
       radius: 30,      <- geofence in metres
       accuracy,        <- reported GPS accuracy of the anchor fix (m)
     }

   Attendance documents (written by students) look like:
     {
       sessionId, studentId, name, courseName,
       timestamp: serverTimestamp,
       distance:  <haversine metres>,
       status: "Present"
     }
   Document ID is `${sessionId}_${studentId}` which makes duplicate marks
   for the same student+session physically impossible in Firestore.
   ========================================================================== */

import {
  collection, doc, addDoc, getDocs, updateDoc,
  query, where, onSnapshot, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { requireRole, setupLogout } from "./auth-guard.js";
import { getGPSPosition, gpsErrorMessage } from "./distance.js";
import { escapeHtml, formatClock, fmtTime, setLoading } from "./utils.js";
import { db, isFirebaseConfigured } from "./firebase-config.js";

/* ------------------------- business constants ------------------------- */
const SESSION_DURATION_MIN = 10;   // a session is valid for exactly 10 minutes
const SESSION_RADIUS_M     = 30;   // geofence radius students must sit inside
const LOW_ATTENDANCE_PCT   = 75;   // below this -> red warning badge
const MAX_TEACHER_FIX_ERR  = 50;   // refuse to anchor a class on a worse GPS fix

/* ------------------------------- state -------------------------------- */
let teacher = null;                // { uid, name, email, role }
let courses = [];                  // this teacher's courses
let selectedCourseId = null;       // course chosen in the dropdown
let activeSession = null;          // live session doc { id, ...fields }
let sessionAttendance = [];        // attendance rows of the live session
let summaryCache = { list: [], total: 0 };   // last computed % table
let unsubSessionDoc = null;        // Firestore listener cancellers
let unsubAttendance = null;
let countdownTimer = null;
let autoStopTriggered = false;     // guards against double auto-stop calls

/* ----------------------------- DOM shortcut --------------------------- */
const $ = (id) => document.getElementById(id);

/* ==========================================================================
   BOOT
   ========================================================================== */
(async function boot() {
  if (!isFirebaseConfigured) { location.replace("login.html"); return; }

  teacher = await requireRole("teacher");
  $("teacherName").textContent = teacher.name || teacher.email;
  setupLogout("logoutBtn");

  /* wire up all controls */
  $("startBtn").addEventListener("click", startSession);
  $("stopBtn").addEventListener("click", () => stopSession("manual"));
  $("createCourseForm").addEventListener("submit", onCreateCourse);
  $("courseSelect").addEventListener("change", (e) => {
    selectedCourseId = e.target.value;
    refreshCourseStats();
  });
  $("exportSessionBtn").addEventListener("click", exportSessionCSV);
  $("exportCourseBtn").addEventListener("click", exportCourseCSV);
  $("refreshSummaryBtn").addEventListener("click", refreshCourseStats);

  await loadCourses();
  await resumeActiveSession();   // survive page refreshes mid-session
})();

/* ==========================================================================
   COURSES
   ========================================================================== */

/** Load this teacher's courses from Firestore and render the dropdown. */
async function loadCourses() {
  const snap = await getDocs(
    query(collection(db, "courses"), where("teacherId", "==", teacher.uid))
  );
  courses = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  renderCourseSelect();
  renderCourseList();
  await refreshCourseStats();
}

function renderCourseSelect() {
  const select = $("courseSelect");
  select.disabled = courses.length === 0;
  select.innerHTML = courses.length
    ? courses.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
    : `<option value="">No courses yet — create one first</option>`;

  /* keep the previous selection when the list reloads */
  if (selectedCourseId && courses.some((c) => c.id === selectedCourseId)) {
    select.value = selectedCourseId;
  } else {
    selectedCourseId = courses[0]?.id ?? null;
  }
}

function renderCourseList() {
  const wrap = $("courseList");
  if (!courses.length) {
    wrap.innerHTML = `<p class="text-secondary small mb-0">No courses yet. Click <strong>New Course</strong> to add your first class.</p>`;
    return;
  }
  wrap.innerHTML = courses.map((c) => {
    const live = activeSession && activeSession.courseId === c.id;
    return `<div class="col-sm-6">
      <div class="course-chip">
        <i class="bi bi-journal-text text-primary"></i>
        <span class="text-truncate">${escapeHtml(c.name)}</span>
        ${live ? '<span class="badge text-bg-danger ms-auto">LIVE</span>' : ""}
      </div>
    </div>`;
  }).join("");
}

/** "New Course" modal submit -> addDoc into "courses". */
async function onCreateCourse(e) {
  e.preventDefault();
  const input = $("courseNameInput");
  const name = input.value.trim();
  if (!name) return;

  const btn = $("createCourseBtn");
  setLoading(btn, true, "Creating…");
  try {
    await addDoc(collection(db, "courses"), {
      name,
      teacherId: teacher.uid,
      teacherName: teacher.name || "",
      createdAt: serverTimestamp()
    });
    input.value = "";
    bootstrap.Modal.getOrCreateInstance($("courseModal")).hide();
    await loadCourses();
  } catch (err) {
    console.error(err);
    alert("Could not create the course: " + err.message);
  } finally {
    setLoading(btn, false);
  }
}

/* ==========================================================================
   SESSIONS — start / watch / stop / auto-expire
   ========================================================================== */

/**
 * START ATTENDANCE
 * 1. Ask the teacher's device for a GPS fix  -> this becomes the CLASSROOM
 *    anchor coordinates stored on the session (lat / lng).
 * 2. Reject unusable fixes (accuracy worse than 50 m).
 * 3. Create the session document with endTime = now + 10 minutes.
 * 4. Attach the live Firestore listeners.
 */
async function startSession() {
  if (activeSession) return;                                    // already running
  if (!selectedCourseId) {
    showAlert("sessionAlert", "warning", "Create a course and select it first.");
    return;
  }

  const btn = $("startBtn");
  setLoading(btn, true, "Getting classroom GPS…");
  try {
    /* 1. anchor the classroom at the teacher's current position */
    const pos = await getGPSPosition();
    const { latitude, longitude, accuracy } = pos.coords;

    /* 2. a garbage fix would misplace the whole geofence */
    if (accuracy > MAX_TEACHER_FIX_ERR) {
      throw new Error(
        `GPS fix too weak (±${Math.round(accuracy)} m). Move near a window or outside and retry.`
      );
    }

    /* 3. safety: never allow two active sessions for the same course */
    const dupQ = query(
      collection(db, "sessions"),
      where("courseId", "==", selectedCourseId),
      where("status", "==", "active")
    );
    const dup = await getDocs(dupQ);
    if (!dup.empty) { watchSession(dup.docs[0].id); return; }   // resume instead

    /* 4. create the session — valid for EXACTLY 10 minutes */
    const course = courses.find((c) => c.id === selectedCourseId);
    await addDoc(collection(db, "sessions"), {
      courseId: selectedCourseId,
      courseName: course?.name ?? "",
      teacherId: teacher.uid,
      teacherName: teacher.name || "",
      status: "active",                                         // 'active' | 'ended'
      startTime: serverTimestamp(),                             // server clock
      endTime: Timestamp.fromMillis(Date.now() + SESSION_DURATION_MIN * 60 * 1000),
      lat: latitude,                                            // classroom anchor
      lng: longitude,
      radius: SESSION_RADIUS_M,                                 // 30 m geofence
      accuracy: Math.round(accuracy)                            // anchor fix quality
    });

    /* the doc snapshot listener below picks it up and renders the panel */
  } catch (err) {
    showAlert("sessionAlert", "danger", err.message || gpsErrorMessage(err));
  } finally {
    setLoading(btn, false);
  }
}

/**
 * Attach real-time listeners for a session:
 *   - onSnapshot(session doc)  -> status changes + 10-minute expiry
 *   - onSnapshot(attendance)   -> LIVE list of students marking present
 */
function watchSession(sessionId) {
  autoStopTriggered = false;

  /* ---- listener 1: the session document itself ---- */
  unsubSessionDoc = onSnapshot(doc(db, "sessions", sessionId), (snap) => {
    if (!snap.exists()) return;
    activeSession = { id: snap.id, ...snap.data() };
    renderSessionPanel();

    if (activeSession.status !== "active") {
      /* ended remotely / already closed -> fold the panel back */
      teardownListeners();
      activeSession = null;
      sessionAttendance = [];
      renderSessionPanel();
      renderLiveAttendance();
      renderCourseList();
    } else {
      /* AUTO-EXPIRE: even if the teacher closes the laptop, whichever
         client notices first flips the status to "ended". */
      const endMs = activeSession.endTime?.toMillis?.() ?? 0;
      if (endMs && Date.now() >= endMs && !autoStopTriggered) {
        autoStopTriggered = true;
        stopSession("expired");
      }
    }
  });

  /* ---- listener 2: this session's attendance rows (LIVE feed) ---- */
  const aq = query(collection(db, "attendance"), where("sessionId", "==", sessionId));
  unsubAttendance = onSnapshot(aq, (snap) => {
    sessionAttendance = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.timestamp?.toMillis?.() ?? 0) - (b.timestamp?.toMillis?.() ?? 0));

    renderLiveAttendance();
    $("statMarkedNow").textContent = String(sessionAttendance.length);

    /* keep the attendance-% table fresh as new marks land */
    if (selectedCourseId) refreshCourseStats();
  });
}

/** If the page was refreshed mid-session, re-attach to the active one. */
async function resumeActiveSession() {
  const snap = await getDocs(
    query(
      collection(db, "sessions"),
      where("teacherId", "==", teacher.uid),
      where("status", "==", "active")
    )
  );
  if (!snap.empty) watchSession(snap.docs[0].id);
}

/**
 * STOP a session (manual button OR automatic 10-minute expiry).
 * Writes status="ended" so STUDENT devices stop accepting marks instantly.
 */
async function stopSession(reason = "manual") {
  teardownListeners();

  if (activeSession && activeSession.status === "active") {
    try {
      await updateDoc(doc(db, "sessions", activeSession.id), {
        status: "ended",
        endedAt: serverTimestamp(),
        endReason: reason            // "manual" | "expired"
      });
    } catch (err) {
      console.error("Failed to close session:", err);
    }
  }

  activeSession = null;
  sessionAttendance = [];
  renderSessionPanel();
  renderLiveAttendance();
  renderCourseList();
}

/** Detach every listener + timer belonging to the live session. */
function teardownListeners() {
  if (unsubSessionDoc) { unsubSessionDoc(); unsubSessionDoc = null; }
  if (unsubAttendance) { unsubAttendance(); unsubAttendance = null; }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

/* ==========================================================================
   RENDERING
   ========================================================================== */

/** Idle panel (Start button) vs live panel (countdown + Stop button). */
function renderSessionPanel() {
  const badge = $("sessionStateBadge");

  if (!activeSession || activeSession.status !== "active") {
    $("sessionIdle").classList.remove("d-none");
    $("sessionLive").classList.add("d-none");
    badge.textContent = "No active session";
    badge.className = "badge bg-secondary-subtle text-secondary-emphasis";
    $("statMarkedNow").textContent = "0";
    return;
  }

  $("sessionIdle").classList.add("d-none");
  $("sessionLive").classList.remove("d-none");

  $("liveCourse").textContent = activeSession.courseName || "—";
  $("liveCoords").textContent =
    `${Number(activeSession.lat).toFixed(6)}, ${Number(activeSession.lng).toFixed(6)}`;
  $("liveAccuracy").textContent =
    activeSession.accuracy ? `±${activeSession.accuracy} m` : "n/a";
  $("liveSessionTag").textContent = `· ${activeSession.courseName || ""}`;

  badge.innerHTML = '<span class="live-dot"></span>SESSION LIVE';
  badge.className = "badge rounded-pill text-bg-danger fw-semibold";
  startCountdown();
}

/** 1-second countdown; auto-stops the session at zero. */
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);

  const tick = () => {
    if (!activeSession?.endTime?.toMillis) return;
    const msLeft = activeSession.endTime.toMillis() - Date.now();
    $("sessionCountdown").textContent = formatClock(msLeft);
    if (msLeft <= 0 && !autoStopTriggered) {
      autoStopTriggered = true;
      stopSession("expired");
    }
  };

  tick();
  countdownTimer = setInterval(tick, 1000);
}

/** Paint the LIVE attendance table from the onSnapshot cache. */
function renderLiveAttendance() {
  const tbody = $("liveAttendanceBody");
  const empty = $("liveEmpty");
  $("exportSessionBtn").disabled = sessionAttendance.length === 0;

  if (!sessionAttendance.length) {
    tbody.innerHTML = "";
    empty.classList.remove("d-none");
    return;
  }

  empty.classList.add("d-none");
  tbody.innerHTML = sessionAttendance.map((r, i) => {
    const when = r.timestamp?.toDate?.();
    return `<tr>
      <td class="text-secondary">${i + 1}</td>
      <td class="fw-semibold">${escapeHtml(r.name || "Student")}</td>
      <td>${when ? fmtTime(when) : "…"}</td>
      <td><span class="mono">${Number.isFinite(r.distance) ? r.distance + " m" : "—"}</span></td>
      <td><span class="badge rounded-pill text-bg-success">Present</span></td>
    </tr>`;
  }).join("");
}

/* ==========================================================================
   ATTENDANCE % SUMMARY (per student, for the selected course)
   ========================================================================== */

/**
 * Fetch every session ever held for the selected course, then every
 * attendance row across those sessions, and aggregate:
 *     rate % = attended ÷ sessions-held × 100
 */
async function refreshCourseStats() {
  if (!selectedCourseId) return;
  try {
    /* all sessions for this course (active + ended) */
    const sSnap = await getDocs(
      query(collection(db, "sessions"), where("courseId", "==", selectedCourseId))
    );
    const sessions = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    $("statSessionsHeld").textContent = String(sessions.length);

    /* attendance across all those sessions.
       'in' queries accept max 30 ids — chunk in slices of 10 for headroom. */
    const ids = sessions.map((s) => s.id);
    const rows = [];
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10);
      const aSnap = await getDocs(
        query(collection(db, "attendance"), where("sessionId", "in", chunk))
      );
      rows.push(...aSnap.docs.map((d) => d.data()));
    }

    /* aggregate per student (name is denormalised on each attendance row) */
    const per = new Map();
    rows.forEach((r) => {
      const entry = per.get(r.studentId) || { name: r.name || "Student", attended: 0 };
      entry.attended += 1;
      per.set(r.studentId, entry);
    });

    const total = sessions.length;
    const list = Array.from(per.entries())
      .map(([id, e]) => ({
        id,
        name: e.name,
        attended: e.attended,
        pct: total ? Math.round((e.attended / total) * 100) : 0
      }))
      .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));

    renderSummary(list, total);
  } catch (err) {
    console.error("refreshCourseStats failed:", err);
  }
}

/** Paint the % table; LOW ATTENDANCE (<75%) gets a red badge. */
function renderSummary(list, totalSessions) {
  summaryCache = { list, total: totalSessions };
  $("summaryCourseName").textContent = courses.find((c) => c.id === selectedCourseId)?.name ?? "";
  $("statLowAttendance").textContent = String(list.filter((s) => s.pct < LOW_ATTENDANCE_PCT).length);

  const tbody = $("summaryBody");
  const emptyEl = $("summaryEmpty");

  if (!list.length) {
    tbody.innerHTML = "";
    emptyEl.classList.remove("d-none");
    return;
  }
  emptyEl.classList.add("d-none");

  tbody.innerHTML = list.map((s) => {
    const low = s.pct < LOW_ATTENDANCE_PCT;
    return `<tr>
      <td class="fw-semibold">${escapeHtml(s.name)}</td>
      <td>${s.attended} / ${totalSessions}</td>
      <td><span class="badge rounded-pill ${low ? "text-bg-danger" : "text-bg-success"}">
        ${s.pct}%${low ? " · low" : ""}</span></td>
    </tr>`;
  }).join("");
}

/* ==========================================================================
   CSV EXPORT
   ========================================================================== */

/** Build a spreadsheet-friendly CSV string (RFC-4180 quoting + Excel BOM). */
function toCSV(header, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "\uFEFF" + [
    header.map(esc).join(","),
    ...rows.map((r) => r.map(esc).join(","))
  ].join("\r\n");
}

/** Trigger a client-side file download. */
function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export the live session's raw attendance log. */
function exportSessionCSV() {
  if (!sessionAttendance.length) return;
  const courseName =
    activeSession?.courseName ||
    courses.find((c) => c.id === selectedCourseId)?.name || "session";

  const rows = sessionAttendance.map((r, i) => [
    i + 1,
    r.name || "",
    r.studentId || "",
    r.timestamp?.toDate?.()?.toLocaleString() ?? "",
    Number.isFinite(r.distance) ? r.distance : "",
    r.status || "Present"
  ]);

  downloadCSV(
    `${courseName.replace(/[^\w-]+/g, "_")}_attendance.csv`,
    toCSV(["#", "Student", "Student ID", "Marked at", "Distance (m)", "Status"], rows)
  );
}

/** Export the per-student attendance % summary for the whole course. */
function exportCourseCSV() {
  const { list, total } = summaryCache;
  if (!list.length) return;
  const courseName = courses.find((c) => c.id === selectedCourseId)?.name || "course";

  const rows = list.map((s, i) => [
    i + 1,
    s.name,
    s.attended,
    total,
    s.pct + "%",
    s.pct < LOW_ATTENDANCE_PCT ? "LOW" : "OK"
  ]);

  downloadCSV(
    `${courseName.replace(/[^\w-]+/g, "_")}_summary.csv`,
    toCSV(["#", "Student", "Sessions attended", "Sessions held", "Attendance %", "Warning"], rows)
  );
}

/* ==========================================================================
   Small inline alert helper for the session card
   ========================================================================== */
function showAlert(containerId, variant, message) {
  $(containerId).innerHTML =
    `<div class="alert alert-${variant} alert-dismissible small mb-3" role="alert">
       ${escapeHtml(message)}
       <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
     </div>`;
}
