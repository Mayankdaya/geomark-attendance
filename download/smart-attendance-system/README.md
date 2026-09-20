# Smart Attendance System (GPS-verified)

A mobile-first web app where teachers open a 10-minute attendance session from
inside the classroom, and students can mark **Present** only when their phone's
GPS places them within **30 metres** of the room — verified with the
**Haversine formula** and stored live in **Google Firestore**.

| Layer      | Technology                                        |
| ---------- | ------------------------------------------------- |
| Frontend   | HTML5, CSS3, JavaScript (ES modules), Bootstrap 5 |
| Backend    | Firebase Authentication                           |
| Database   | Cloud Firestore (real-time listeners)             |
| Location   | Browser Geolocation API + Haversine formula       |
| Hosting    | Firebase Hosting (static — no server needed)      |

---

## Folder structure

```
smart-attendance-system/
├── index.html            Landing page (public marketing + role CTAs)
├── login.html            Login / Sign-up (role picker: teacher or student)
├── teacher.html          Teacher dashboard (session + live list + reports)
├── student.html          Student dashboard (mark attendance + history)
├── css/
│   └── style.css         Custom styles (mobile-first, green/red feedback)
├── js/
│   ├── firebase-config.js  Firebase init — PASTE YOUR CONFIG HERE
│   ├── distance.js         Haversine formula + GPS helpers + 20 m gate
│   ├── utils.js            Escape/format/loading-state helpers
│   ├── auth-guard.js       Page guards (requireRole), logout, redirects
│   ├── auth.js             Login + register logic
│   ├── landing.js          Auto-redirect for signed-in visitors
│   ├── teacher.js          Sessions, live feed, attendance %, CSV export
│   └── student.js          Active sessions, GPS marking, date-wise history
├── firestore.rules       Security rules (role-based, append-only attendance)
├── firebase.json         Hosting + rules deployment config
├── .firebaserc           Project alias (replace YOUR_PROJECT_ID)
└── README.md             This file
```

---

## 1. One-time Firebase setup (≈ 5 minutes)

1. **Create the project** — go to <https://console.firebase.google.com>,
   click **Add project**, name it (e.g. `smart-attendance`).
2. **Register a web app** — Project settings → *Your apps* → **</>** (Web),
   copy the `firebaseConfig` object it generates.
3. **Paste the config** into `js/firebase-config.js` (replace the
   `YOUR_*` placeholders) and into `.firebaserc` (`YOUR_PROJECT_ID`).
4. **Enable Authentication** — Build → Authentication → Get started →
   **Email/Password** → Enable → Save.
5. **Create Firestore** — Build → Firestore Database → Create database →
   Production mode → pick a region.

No collections need to be created by hand — they appear automatically:
`users`, `courses`, `sessions`, `attendance`.

## 2. Run it locally

Geolocation only works on **https** or **localhost**, so serve the folder
instead of double-clicking the HTML files:

```bash
cd smart-attendance-system
npx serve .            # or: python3 -m http.server 8000
```

Open the printed URL, create one teacher account and one student account,
and test on two devices (or two browser profiles).

## 3. Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase use --add                 # pick your project, alias: default
firebase deploy                    # hosting + firestore rules together
```

Your app is live at `https://YOUR_PROJECT_ID.web.app`.
**HTTPS is automatic** — geolocation will work on the deployed URL.

---

## How the anti-proxy logic works

| # | Mechanism              | Where                                        |
| - | ---------------------- | -------------------------------------------- |
| 1 | **10-minute expiry**   | `sessions.endTime = start + 10 min`. Teacher UI auto-stops at 00:00; student UI hides the card, re-checks the session fresh before writing, and the status is flipped to `ended`. |
| 2 | **20 m accuracy gate** | `position.coords.accuracy > 20` → the fix is rejected ("GPS accuracy too low"). Spoofed/weak signals usually report far worse accuracy. |
| 3 | **30 m geofence**      | Haversine distance from the student's fix to the session's `lat/lng`; anything above `session.radius` (30 m) is rejected with "You are N m away". |
| 4 | **One mark / session** | The attendance document ID is `sessionId_studentId`, so a second mark by the same student for the same session cannot create a new document. Firestore rules additionally make attendance **append-only** (no update/delete). |
| 5 | **Audit trail**        | Every entry stores the server timestamp (`serverTimestamp()`), the calculated `distance` in metres, and the student's denormalised name. |

## Firestore data model

```
users/{uid}
    uid, name, email, role ("teacher" | "student"), createdAt

courses/{courseId}                  ← created by the teacher
    name, teacherId, teacherName, createdAt

sessions/{sessionId}                ← created when teacher taps "Start Attendance"
    courseId, courseName, teacherId, teacherName,
    status ("active" | "ended"), startTime, endTime (start + 10 min),
    lat, lng (classroom anchor), radius (30), accuracy, endedAt, endReason

attendance/{sessionId_studentId}    ← written by the student
    sessionId, studentId, name, courseName,
    timestamp (server), distance (m, Haversine), status ("Present")
```

> `courseName` / `teacherName` are denormalised on purpose so the dashboards
> render without extra reads. The summary table on the teacher dashboard
> computes `rate = attended ÷ sessions-held` per course; students appear in
> it after their first mark (there is no enrollment collection in this schema).

## Testing tips

- **Two devices** is the most realistic test (teacher phone + student phone).
- On desktop Chrome: DevTools → *More tools → Sensors* → Location lets you
  override coordinates. Set the teacher's position, start a session, then
  move the student override ~0.0005° away (≈ 55 m) to see the rejection.
- Indoors, GPS accuracy often hovers at 15–40 m. If the accuracy gate
  rejects you constantly, step nearer a window. For demo comfort you can
  raise `MAX_ALLOWED_ACCURACY` in `js/distance.js` (default 20 m) and the
  radius in `js/teacher.js` / `js/student.js` (default 30 m).
- Clocks: expiry compares the device clock against `endTime`; NTP-synced
  phones are fine. For strict server-side expiry, add a scheduled Cloud
  Function that flips `status` to `ended` when `endTime < now`.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| "Firebase isn't configured yet" banner | You didn't replace the `YOUR_*` values in `js/firebase-config.js`. |
| Location permission denied | Allow location for the site (padlock icon → Site settings). |
| "GPS accuracy too low" every time | Poor signal indoors — try near a window, or relax the 20 m gate for demos. |
| Live list not updating | Check the browser console; make sure Firestore is created and rules deployed (`firebase deploy --only firestore:rules`). |
| `Missing or insufficient permissions` | Rules not deployed, or the user's `users/{uid}` doc is missing — re-register. |
| Attendance % table empty | Students appear after their first mark in the selected course. |

## Ideas for hardening / extending

- **Enrollment collection** — `enrollments/{courseId_studentId}` so the
  attendance % includes enrolled-but-never-present students.
- **Cloud Function validator** — recompute Haversine server-side in an
  `onCreate` trigger and delete marks that fail the geofence.
- **Bluetooth/Wi-Fi presence cross-check** — require a BLE beacon scan for
  high-stakes exams.
- **Session TTL policy** — Firestore managed TTL as a backup cleanup.
