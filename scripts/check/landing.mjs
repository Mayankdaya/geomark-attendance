/* ==========================================================================
   LANDING PAGE — js/landing.js
   --------------------------------------------------------------------------
   index.html is a public marketing page. The only logic needed here is:
   if the visitor is already logged in, send them straight to their
   dashboard instead of making them click Login again.
   ========================================================================== */

import { redirectIfAuthenticated } from "./auth-guard.js";

redirectIfAuthenticated();
