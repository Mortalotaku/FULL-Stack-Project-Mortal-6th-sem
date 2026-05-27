# Campus Club Platform

College campus software for **club participants**: links with **college ERP**, lists **upcoming events**, allows **enrollment**, **verifies attendance**, and issues **participation certificates**.

## Features

| Module | What it does |
|--------|----------------|
| **ERP link** | Webhook receives official student IDs/names from college ERP |
| **Events** | Upcoming college & club events with capacity |
| **Enrollment** | Students enroll using ERP student ID (must exist in directory) |
| **Attendance** | Coordinator shares event code; student verifies → attendance recorded |
| **Certificates** | Issued after verified attendance; public token verification |
| **Admin** | Create events, view attendance lists (API key) |

## Quick start

```bash
cd campus-club-platform
npm install
npm start
```

Open **http://localhost:4000**

## Demo flow (5 minutes)

1. **Home** — read overview; note demo IDs `STU-2024-001`, `002`, `003`
2. **Upcoming events** — copy an event ID (e.g. `evt-1`)
3. **Enroll** — event ID + `STU-2024-001`
4. **Get attendance code** (coordinator):
   ```bash
   curl http://localhost:4000/api/events | jq '.[0].attendanceCode'
   ```
5. **Verify attendance** — event ID + student ID + code
6. **Certificates** — issue & print certificate for that student/event
7. **ERP link** — run demo sync or POST from real ERP

## ERP integration

**POST** `/api/erp/webhook`

Header: `X-ERP-Secret: demo-erp-secret-change-me` (change via `ERP_WEBHOOK_SECRET`)

```json
{
  "students": [
    {
      "erpStudentId": "STU-2024-001",
      "fullName": "Aisha Khan",
      "email": "aisha@college.edu",
      "department": "CS"
    }
  ]
}
```

**GET** `/api/erp/status` — sync status

## API summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/upcoming` | Upcoming events |
| POST | `/api/enrollments` | Enroll `{ eventId, erpStudentId }` |
| POST | `/api/attendance/verify` | Verify `{ eventId, erpStudentId, attendanceCode }` |
| POST | `/api/certificates/issue` | Issue after attendance |
| GET | `/api/certificates/verify?token=` | Public certificate check |
| POST | `/api/events` | Create event (header `X-Admin-Key: admin-demo`) |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | Server port |
| `ERP_WEBHOOK_SECRET` | `demo-erp-secret-change-me` | ERP webhook auth |
| `ADMIN_KEY` | `admin-demo` | Admin API routes |

## Project structure

```
campus-club-platform/
├── server.js
├── lib/store.js
├── data/              # JSON persistence (gitignored)
└── public/
    ├── index.html
    ├── events.html
    ├── enroll.html
    ├── verify-attendance.html
    ├── certificates.html
    └── erp.html
```

## Note on hotel-booking folder

The parent `hotel-booking` project was an earlier assignment prototype. **This folder is the campus club / ERP / attendance / certificate product you asked for.**
