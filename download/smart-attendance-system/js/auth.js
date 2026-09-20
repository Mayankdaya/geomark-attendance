/* ==========================================================================
   AUTH PAGE LOGIC — js/auth.js
   --------------------------------------------------------------------------
   Handles both forms on login.html:

     LOGIN    -> signInWithEmailAndPassword -> read role -> redirect
     REGISTER -> createUserWithEmailAndPassword
               -> write users/{uid} profile doc (name, email, ROLE)
               -> redirect to the role's dashboard

   The `role` stored in the profile document is what drives the page
   guards and the Firestore security rules, so students can never open
   the teacher dashboard and vice-versa.
   ========================================================================== */

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db, isFirebaseConfigured } from "./firebase-config.js";
import { dashboardFor, fetchProfile, redirectIfAuthenticated } from "./auth-guard.js";
import { setLoading } from "./utils.js";

/* Already signed in with a valid profile? Skip the form entirely. */
redirectIfAuthenticated();

const $ = (id) => document.getElementById(id);
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const authAlert = $("authAlert");

/* ------------------------------------------------------------------ */
/* Tab switching between Login and Sign up                            */
/* ------------------------------------------------------------------ */
function switchTab(showLogin) {
  loginForm.classList.toggle("d-none", !showLogin);
  registerForm.classList.toggle("d-none", showLogin);
  $("tabLogin").classList.toggle("active", showLogin);
  $("tabRegister").classList.toggle("active", !showLogin);
  authAlert.classList.add("d-none");
}
$("tabLogin").addEventListener("click", () => switchTab(true));
$("tabRegister").addEventListener("click", () => switchTab(false));

/* Deep links from the landing page: login.html?mode=register&role=teacher */
const params = new URLSearchParams(location.search);
if (params.get("mode") === "register") switchTab(false);
const preRole = params.get("role");
if (preRole === "teacher" || preRole === "student") {
  const radio = document.querySelector(`input[name="role"][value="${preRole}"]`);
  if (radio) radio.checked = true;
}

/* ------------------------------------------------------------------ */
/* Friendly error copy for common Firebase error codes                */
/* ------------------------------------------------------------------ */
const FRIENDLY_ERRORS = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/email-already-in-use": "That email is already registered — try logging in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please wait a minute and try again.",
  "auth/network-request-failed": "Network error. Check your internet connection."
};

function showError(message) {
  authAlert.className = "alert alert-danger small";
  authAlert.textContent = message;
  authAlert.classList.remove("d-none");
}

/* ------------------------------------------------------------------ */
/* Un-configured Firebase? Show the setup banner, hide the forms.     */
/* ------------------------------------------------------------------ */
if (!isFirebaseConfigured) {
  $("setupBanner").classList.remove("d-none");
  loginForm.classList.add("d-none");
  registerForm.classList.add("d-none");
  $("authTabs").classList.add("d-none");
}

/* ------------------------------------------------------------------ */
/* LOGIN                                                              */
/* ------------------------------------------------------------------ */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("loginBtn");
  authAlert.classList.add("d-none");
  setLoading(btn, true, "Signing in…");

  try {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await fetchProfile(cred.user.uid);

    /* Safety net: account exists in Auth but has no profile document
       (e.g. registration was interrupted). Force a clean re-register. */
    if (!profile) {
      await signOut(auth);
      showError("This account has no profile yet. Please sign up again.");
      return;
    }
    location.replace(dashboardFor(profile.role));
  } catch (err) {
    console.error(err);
    showError(FRIENDLY_ERRORS[err.code] || err.message || "Login failed. Please try again.");
  } finally {
    setLoading(btn, false);
  }
});

/* ------------------------------------------------------------------ */
/* REGISTER                                                           */
/* ------------------------------------------------------------------ */
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("regBtn");
  authAlert.classList.add("d-none");

  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim();
  const password = $("regPassword").value;
  const role = document.querySelector('input[name="role"]:checked')?.value;

  if (!name) { showError("Please enter your full name."); return; }
  if (!role) { showError("Please choose Teacher or Student."); return; }

  setLoading(btn, true, "Creating account…");

  try {
    /* 1. Create the Auth account (handles password hashing etc.) */
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    /* 2. Write the profile document that defines the user's role.
          Structure: users/{uid} = { uid, name, email, role } */
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      name,
      email,
      role,                              // "teacher" | "student"
      createdAt: serverTimestamp()
    });

    /* 3. Straight to the correct dashboard. */
    location.replace(dashboardFor(role));
  } catch (err) {
    console.error(err);
    showError(FRIENDLY_ERRORS[err.code] || err.message || "Registration failed.");
    /* If Auth was created but the profile write failed, sign out so the
       user gets a clean retry instead of a broken half-registered state. */
    if (err.code !== "auth/email-already-in-use" && auth.currentUser) {
      await signOut(auth);
    }
  } finally {
    setLoading(btn, false);
  }
});
