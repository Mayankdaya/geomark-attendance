---
title: GeoMark GPS Attendance
emoji: 📍
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# GeoMark — GPS Smart Attendance

GPS-verified attendance: teachers open 10-minute sessions, students check in only
from inside the 30 m classroom geofence. Built with Next.js 16, Prisma and SQLite.

## Run locally

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000 — demo logins:

| Role    | Email              | Password    |
| ------- | ------------------ | ----------- |
| Teacher | sarah@campus.edu   | teacher123  |
| Student | alex@campus.edu    | student123  |

## Deploy (Docker — Hugging Face Spaces / Render / Railway / any VPS)

```bash
docker build -t geomark .
docker run -p 3000:3000 -v geomark-db:/app/db geomark
```

On first boot the container syncs the schema (`prisma db push`) and seeds demo
data if the database is empty. The app reads the `PORT` env var automatically.
For a permanent public URL with data that survives restarts, mount persistent
storage at `/app/db` (free tiers use ephemeral disks — demo data is re-seeded
on every restart).
