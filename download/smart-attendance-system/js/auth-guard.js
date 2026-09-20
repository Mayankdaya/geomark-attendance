/* ==========================================================================
   AUTH GUARD — js/auth-guard.js
   --------------------------------------------------------------------------
   Shared authentication plumbing for every protected page:

     requireRole(role)            -> dashboard page guard
     redirectIfAuthenticated()    -> used on index/login to skip ahead
     fetchProfile(uid)            -> read users/{uid} from Firestore
     dashboardFor(role)           -> role -> page URL mapping
     setupLogout(buttonId)        -> wire up a logout button
   ========================================================================== */

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db, isFirebaseConfigured } from "./firebase-config.js";

/** Map a role to its dashboard page. */
export function dashboardFor(role) {
  return role === "teacher" ? "teacher.html" : "student.html";
}

/**
 * Load a user's profile document (users/{uid}) from Firestore.
 * Returns { uid, name, email, role } or null when the doc is missing.
 */
export async function fetchProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/**
 * PAGE GUARD — call at the top of every dashboard:
 *
 *   const teacher = await requireRole("teacher");
 *
 * Waits for Firebase to restore the session, then:
 *   - not logged in               -> redirect to login.html
 *   - no Firestore profile yet    -> redirect to login.html
 *   - wrong role                  -> redirect to the correct dashboard
 *   - otherwise                   -> resolve with the profile object
 */
export function requireRole(expectedRole) {
  return new Promise((resolve) => {
    if (!isFirebaseConfigured) { location.replace("login.html"); return; }

    onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) { location.replace("login.html"); return; }

        const profile = await fetchProfile(user.uid);
        if (!profile) { location.replace("login.html"); return; }

        if (profile.role !== expectedRole) {
          location.replace(dashboardFor(profile.role));
          return;
        }
        resolve(profile);
      } catch (err) {
        console.error("Auth guard failed:", err);
        location.replace("login.html");
      }
    });
  });
}

/**
 * For public pages (index.html / login.html): if the visitor already has a
 * valid session + profile, jump straight to their dashboard.
 */
export function redirectIfAuthenticated() {
  if (!isFirebaseConfigured) return;
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const profile = await fetchProfile(user.uid);
      if (profile) location.replace(dashboardFor(profile.role));
    } catch { /* profile not readable yet — stay on this page */ }
  });
}

/** Attach sign-out behaviour to a navbar logout button. */
export function setupLogout(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try { await signOut(auth); } finally { location.href = "login.html"; }
  });
}
