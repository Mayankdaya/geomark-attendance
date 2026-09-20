/* ==========================================================================
   SHARED UI HELPERS — js/utils.js
   --------------------------------------------------------------------------
   Small, dependency-free helpers used by both dashboards and the auth page:
   HTML escaping (XSS safety), clock/time formatting and button loading
   states with an inline spinner.
   ========================================================================== */

/**
 * Escape user-generated text before injecting it into innerHTML.
 * Prevents XSS when names / course names contain <, >, quotes, & etc.
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Format a remaining-time value in milliseconds as "MM:SS" (e.g. "09:07").
 * Negative values are clamped to 00:00. Used for the 10-minute countdowns.
 */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** "14:32" style short local time — used in tables and history rows. */
export function fmtTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** "Saturday, 20 Sep 2026" style heading — used for date groups in history. */
export function fmtDateHeading(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

/**
 * Toggle a button between its normal label and a spinner state.
 *   setLoading(btn, true,  "Starting…")  -> disabled + spinner + label
 *   setLoading(btn, false)               -> restore original content
 */
export function setLoading(btn, on, label = "Working…") {
  if (on) {
    btn.dataset.original = btn.innerHTML;             // remember real content
    btn.disabled = true;
    btn.innerHTML =
      `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${label}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.original) btn.innerHTML = btn.dataset.original;
  }
}
