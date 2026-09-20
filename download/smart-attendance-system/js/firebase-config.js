/* ==========================================================================
   FIREBASE CONFIGURATION — js/firebase-config.js
   --------------------------------------------------------------------------
   Single shared entry point that initialises Firebase and exports the
   services used across the app (Auth + Firestore).

   SETUP (one time):
     1. Go to https://console.firebase.google.com and create a project.
     2. Project settings -> "Your apps" -> Add a Web app (</>) and copy the
        firebaseConfig object it shows you.
     3. Paste it into the `firebaseConfig` object below.
     4. In the console enable:
          - Authentication -> Sign-in method -> Email/Password
          - Firestore Database  (start in production mode, we ship rules)

   We load the Firebase SDK as native ES modules straight from Google's CDN,
   so NO bundler / npm install is required to run this project.
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* vvvvvvvvvv  REPLACE THE VALUES BELOW WITH YOUR OWN PROJECT CONFIG  vvvvvvvvvv */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
/* ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */

/* Initialise the app once and export the two services every page needs. */
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);       // Firebase Authentication
export const db = getFirestore(app);    // Cloud Firestore

/* True only when the placeholder config above has been replaced.
   Pages use this flag to show a friendly "setup needed" banner instead of
   flooding the console with confusing Firebase errors. */
export const isFirebaseConfigured =
  !firebaseConfig.apiKey.startsWith("YOUR_") &&
  !firebaseConfig.projectId.startsWith("YOUR_");
