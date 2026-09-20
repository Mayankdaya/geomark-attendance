/* ==========================================================================
   STUDENT DASHBOARD — js/student.js
   --------------------------------------------------------------------------
   Responsibilities:
     1. Page guard (student role only)
     2. LIVE list of active sessions  (onSnapshot on "sessions")
     3. MARK ATTENDANCE pipeline:
          re-check session -> GPS fix -> accuracy gate (<= 20 m)
          -> Haversine distance -> 30 m geofence -> one-mark-per-session
          -> write attendance doc with timestamp + distance
     4. Attendance history grouped by date + summary stat cards
   ========================================================================== */

import {
  collection, doc, getDoc, getDocs, setDoc,
  query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { requireRole, setupLogout } from "./auth-guard.js";
import {
  getGPSPosition, gpsErrorMessage,
  haversineDistance, MAX_ALLOWED_ACCURACY
} from "./distance.js";
import { escapeHtml, formatClock, fmtTime, fmtDateHeading } from "./utils.js";
import { db, isFirebaseConfigured } from "./firebase-config.js";

const LOW_ATTENDANCE_PCT = 75;   // warning banner threshold

/* ------------------------------- state --------------------------------- */
let student = null;              // { uid, name, email, role }
let activeSessions = [];         // raw docs where status == "active"
let myMarks = new Map();         // sessionId -> my attendance doc
let sessionsHeld = 0;            // total sessions ever created (all courses)
let unsubSessions = null;        // Firestore listener cancellers
let unsubMarks = null;
let tickTimer = null;

/* ----------------------------- DOM shortcut ---------------------------- */
const $ = (id) => document.getElementById(id);

/* ==========================================================================
   BOOT
   ========================================================================== */
(async function boot() {
  if (!isFirebaseConfigured) { location.replace("login.html"); return; }

  student = await requireRole("student");
  $("studentName").textContent = student.name || student.email;
  setupLogout("logoutBtn");

  $("viewSessionsBtn").addEventListener("click", () => switchView("sessions"));
  $("viewHistoryBtn").addEventListener("click", () => switchView("history"));

  watchActiveSessions();   // real-time: session appears the moment it starts
  watchMyMarks();          // real-time: my marks -> cards + history + stats
  await refreshSessionsHeld();

  /* 1-second heartbeat: updates countdowns and sweeps expired sessions */
  tickTimer = setInterval(tick, 1000);
})();

/* ==========================================================================
   REAL-TIME LISTENERS
   ========================================================================== */

/** Every session whose status is "active" — appears/disappears LIVE. */
function watchActiveSessions() {
  const q = query(collection(db, "sessions"), where("status", "==", "active"));
  unsubSessions = onSnapshot(q, (snap) => {
    activeSessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSessions();
  });
}

/**
 * All attendance docs written by ME. Drives three things at once:
 *   - the "already marked" state on session cards
 *   - the date-grouped history view
 *   - the stat cards (attended / rate)
 */
function watchMyMarks() {
  const q = query(collection(db, "attendance"), where("studentId", "==", student.uid));
  unsubMarks = onSnapshot(q, (snap) => {
    myMarks = new Map(snap.docs.map((d) => [d.data().sessionId, { id: d.id, ...d.data() }]));
    renderSessions();
    renderHistory();
    refreshSessionsHeld();   // total may have changed; cheap at class scale
  });
}

/** Count of ALL sessions ever created (any course, any status). */
async function refreshSessionsHeld() {
  try {
    const snap = await getDocs(collection(db, "sessions"));
    sessionsHeld = snap.size;
    renderStats();
  } catch (err) {
    console.error("refreshSessionsHeld failed:", err);
  }
}

/* ==========================================================================
   HEARTBEAT — countdown updates + expiry sweep
   ========================================================================== */
function tick() {
  /* ANTI-PROXY: a session whose 10-minute window has passed is hidden
     immediately, even if the teacher's device never flipped the status. */
  const stillValid = activeSessions.filter(
    (s) => s.status === "active" && (s.endTime?.toMillis?.() ?? 0) > Date.now()
  );
  if (stillValid.length !== visibleCount()) renderSessions();

  /* refresh every visible "Ends in MM:SS" */
  document.querySelectorAll("[data-end]").forEach((el) => {
    const msLeft = Number(el.dataset.end) - Date.now();
    el.textContent = msLeft > 0 ? formatClock(msLeft) : "00:00";
  });
}
/** helper: how many session cards are currently on screen */
const visibleCount = () =>
  document.querySelectorAll("#sessionsWrap .session-card").length;

/* ==========================================================================
   ACTIVE SESSION CARDS
   ========================================================================== */
function renderSessions() {
  const wrap = $("sessionsWrap");
  const empty = $("sessionsEmpty");

  const visible = activeSessions.filter(
    (s) => (s.endTime?.toMillis?.() ?? 0) > Date.now()
  );

  if (!visible.length) {
    wrap.innerHTML = "";
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  wrap.innerHTML = visible.map((s) => {
    const marked = myMarks.get(s.id);
    const started = s.startTime?.toDate?.();
    const markedAt = marked?.timestamp?.toDate?.();

    /* If already marked -> green confirmation box replaces the button */
    const action = marked
      ? `<div class="feedback ok mb-0">✅ Present! Marked ${markedAt ? "at " + fmtTime(markedAt) : ""} · ${marked.distance} m from classroom</div>`
      : `<button class="btn btn-primary w-100" id="mark-${s.id}" data-session="${s.id}">
           <i class="bi bi-geo-alt-fill"></i> Mark Attendance</button>`;

    return `
      <div class="col-md-6 col-xl-4">
        <div class="card app-card h-100 session-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-1 gap-2">
              <h3 class="h6 fw-bold mb-0 text-truncate">${escapeHtml(s.courseName || "Class session")}</h3>
              <span class="badge rounded-pill text-bg-danger flex-shrink-0"><span class="live-dot"></span>LIVE</span>
            </div>
            <p class="text-secondary small mb-2">
              ${escapeHtml(s.teacherName || "")}${started ? " · started " + fmtTime(started) : ""}
            </p>
            <p class="small mb-3">
              <i class="bi bi-stopwatch text-primary"></i>
              Ends in <span class="mono fw-semibold" data-end="${s.endTime.toMillis()}">--:--</span>
              <span class="text-secondary">· geofence ${s.radius ?? 30} m</span>
            </p>
            <div class="feedback bad d-none" id="fb-${s.id}" aria-live="polite"></div>
            ${action}
          </div>
        </div>
      </div>`;
  }).join("");

  /* (re)bind Mark Attendance buttons */
  wrap.querySelectorAll("[data-session]").forEach((btn) => {
    btn.addEventListener("click", () => markAttendance(btn.dataset.session));
  });
}

/* ==========================================================================
   MARK ATTENDANCE — the GPS-verified core of the whole system
   ========================================================================== */
async function markAttendance(sessionId) {
  const btn = $(`mark-${sessionId}`);
  const fb = $(`fb-${sessionId}`);
  const setFb = (cls, html) => {
    fb.className = `feedback ${cls}`;
    fb.innerHTML = html;
  };

  /* already marked? (listener cache says so) */
  if (myMarks.has(sessionId)) {
    setFb("warn", "You already marked attendance for this session.");
    return;
  }

  /* enter loading state — spinner runs while GPS is being fetched */
  btn.disabled = true;
  const original = btn.innerHTML;
  btn.innerHTML =
    `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Getting your GPS position…`;

  try {
    /* STEP 0 — re-read the session fresh: it may have expired while we
       were waiting, or the teacher may have stopped it manually. */
    const sSnap = await getDoc(doc(db, "sessions", sessionId));
    if (!sSnap.exists()) throw new Error("Session not found.");
    const session = { id: sSnap.id, ...sSnap.data() };

    if (session.status !== "active") throw new Error("This session has ended.");
    if ((session.endTime?.toMillis?.() ?? 0) <= Date.now()) {
      throw new Error("This session has expired (10-minute limit).");
    }

    /* STEP 1 — ask the device for a fresh high-accuracy GPS fix. */
    const pos = await getGPSPosition();
    const { latitude, longitude, accuracy } = pos.coords;

    /* STEP 2 — ANTI-PROXY GATE #1: reject weak / spoofed readings.
       Anything less accurate than 20 m cannot prove you are in the room. */
    if (accuracy > MAX_ALLOWED_ACCURACY) {
      throw new Error(
        `GPS accuracy too low (±${Math.round(accuracy)} m). Move to an open spot and retry.`
      );
    }

    /* STEP 3 — HAVERSINE: straight-line distance to the classroom anchor. */
    const distance = Math.round(
      haversineDistance(latitude, longitude, session.lat, session.lng)
    );

    /* STEP 4 — ANTI-PROXY GATE #2: the 30 m geofence. */
    if (distance > (session.radius ?? 30)) {
      throw new Error(`You are ${distance} m away — move closer to the classroom.`);
    }

    /* STEP 5 — ANTI-PROXY GATE #3: ONE mark per student per session.
       The document ID is `sessionId_studentId`, so a duplicate mark would
       have to overwrite the same Firestore document — pre-checked here. */
    const attRef = doc(db, "attendance", `${sessionId}_${student.uid}`);
    const existing = await getDoc(attRef);
    if (existing.exists()) {
      myMarks.set(sessionId, { id: existing.id, ...existing.data() });
      renderSessions();
      return;
    }

    /* STEP 6 — write the mark: timestamp (server clock) + calculated
       distance are stored with EVERY entry for auditing. */
    await setDoc(attRef, {
      sessionId,
      studentId: student.uid,
      name: student.name || "",
      courseName: session.courseName || "",
      timestamp: serverTimestamp(),
      distance,                    // metres, via Haversine
      status: "Present"
    });

    setFb("ok", `✅ Present! You are ${distance} m from the classroom.`);
  } catch (err) {
    setFb("bad", `❌ ${friendlyError(err)}`);
  } finally {
    /* the onSnapshot listener usually re-renders the card first;
       only restore the button if it is still in the DOM */
    if (document.body.contains(btn)) {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }
}

/** Map GPS API errors + app errors to readable feedback. */
function friendlyError(err) {
  if (err && typeof err.code === "number") {           // GeolocationPositionError
    if (err.code === 1) return "Location permission denied. Allow location access and retry.";
    if (err.code === 2) return "Location unavailable. Turn on GPS and retry.";
    if (err.code === 3) return "GPS took too long — step outside and try again.";
  }
  return err?.message || gpsErrorMessage(err);
}

/* ==========================================================================
   HISTORY (date-wise) + STAT CARDS
   ========================================================================== */
function renderHistory() {
  renderStats();

  const wrap = $("historyWrap");
  const empty = $("historyEmpty");

  /* newest first */
  const rows = Array.from(myMarks.values()).sort(
    (a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0)
  );

  if (!rows.length) {
    wrap.innerHTML = "";
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  /* group by LOCAL calendar date (yyyy-mm-dd keys, sorted newest first) */
  const groups = new Map();
  rows.forEach((r) => {
    const d = r.timestamp?.toDate?.() ?? new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!groups.has(key)) groups.set(key, { date: d, items: [] });
    groups.get(key).items.push(r);
  });

  wrap.innerHTML = Array.from(groups.values()).map(({ date, items }) => `
    <div class="card app-card mb-3">
      <div class="card-header bg-transparent fw-semibold small">
        <i class="bi bi-calendar3 text-primary"></i> ${fmtDateHeading(date)}
      </div>
      <ul class="list-group list-group-flush">
        ${items.map((r) => `
          <li class="list-group-item d-flex justify-content-between align-items-center gap-3">
            <div class="min-w-0">
              <div class="fw-semibold text-truncate">${escapeHtml(r.courseName || "Class session")}</div>
              <div class="text-secondary small">
                ${r.timestamp?.toDate?.() ? fmtTime(r.timestamp.toDate()) : "…"}
                · ${Number.isFinite(r.distance) ? r.distance + " m away" : "—"}
              </div>
            </div>
            <span class="badge rounded-pill text-bg-success flex-shrink-0">${escapeHtml(r.status || "Present")}</span>
          </li>`).join("")}
      </ul>
    </div>`).join("");
}

/** Stat cards: attended / held / rate + low-attendance warning banner. */
function renderStats() {
  const attended = myMarks.size;
  const pct = sessionsHeld ? Math.round((attended / sessionsHeld) * 100) : 0;

  $("statAttended").textContent = String(attended);
  $("statSessionsHeld").textContent = String(sessionsHeld);
  $("statRate").textContent = pct + "%";

  const banner = $("lowBanner");
  if (sessionsHeld > 0 && pct < LOW_ATTENDANCE_PCT) {
    $("lowBannerPct").textContent = pct + "%";
    banner.classList.remove("d-none");
  } else {
    banner.classList.add("d-none");
  }
}

/* ==========================================================================
   VIEW SWITCHING (Active Sessions | History)
   ========================================================================== */
function switchView(view) {
  const showSessions = view === "sessions";
  $("viewSessions").classList.toggle("d-none", !showSessions);
  $("viewHistory").classList.toggle("d-none", showSessions);
  $("viewSessionsBtn").classList.toggle("active", showSessions);
  $("viewHistoryBtn").classList.toggle("active", !showSessions);
}
