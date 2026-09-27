# Production-Grade Email Job Scheduler & Dashboard

A high-throughput, distributed **Email Job Scheduler** built with **Express.js**, **BullMQ**, **Redis**, **PostgreSQL (Prisma ORM)**, **Elasticsearch**, **Nodemailer (Ethereal SMTP)**, and **Next.js 14**. Designed specifically for high scale, zero-cron delayed execution, restart durability, and per-sender rate-limiting with Slack alerts.

---

## Technical Stack

| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Backend** | TypeScript + Express.js | Fast, scalable HTTP layer and background worker process host. |
| **Queue Engine** | BullMQ + Redis 7 | High-performance delayed job queues. No cron dependencies. |
| **Database & ORM** | PostgreSQL 16 + Prisma ORM | Strong ACID guarantees, auto-migrations, and declarative schema type safety. |
| **Search Engine** | Elasticsearch 8 | Multi-field fuzzy search over scheduled and sent email logs with DB fallback. |
| **SMTP Transport** | Nodemailer + Ethereal Email | Auto-creates fake SMTP accounts on startup with live browser viewable links. |
| **Slack Alerts** | Slack Webhook & OAuth 2.0 API | Real-time notification trigger when sender hourly rate limits are hit. |
| **Frontend** | Next.js 14 + NextAuth + Tailwind CSS | Responsive dashboard, Google OAuth login, CSV lead parser, and live tables. |

---

## Directory Structure

```text
e:/outbox
├── docker-compose.yml           # Postgres 16, Redis 7, Elasticsearch 8 containers
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # User and EmailJob database models
│   ├── src/
│   │   ├── config/              # Environment variable loader
│   │   ├── db/                  # Prisma client wrapper
│   │   ├── queue/               # BullMQ queue, worker, and boot reconciliation logic
│   │   ├── routes/              # Express API endpoints (emails, search, slack, queue)
│   │   ├── services/            # Ethereal SMTP, Elasticsearch, and Slack integrations
│   │   └── index.ts             # Main Express server & Bull Board mount point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router (login page, dashboard page, auth API)
│   │   ├── components/          # Reusable Header, EmailTable, ComposeModal, SessionProvider
│   │   └── lib/                 # NextAuth configuration
│   ├── package.json
│   └── tailwind.config.js
└── README.md                    # Project documentation & setup guide
```

---

## Quickstart & How to Run

### 1. Start Infrastructure (Docker)
Ensure Docker Desktop is running, then execute:
```bash
docker-compose up -d
```
This starts:
- **PostgreSQL** on `localhost:5432`
- **Redis** on `localhost:6379`
- **Elasticsearch** on `localhost:9200`

### 2. Start Backend Service
```bash
cd backend
npm install
npx prisma db push
npm run build
npm start
```
*Backend runs on `http://localhost:4000`*.
- **Bull Board Dashboard**: `http://localhost:4000/admin/queues`
- **Health Check**: `http://localhost:4000/health`

On boot, the backend automatically prints generated Ethereal test SMTP credentials to the console.

### 3. Start Frontend Dashboard
In a new terminal window:
```bash
cd frontend
npm install
npm run build
npm start
```
*Frontend runs on `http://localhost:3000`*.

---

## Environment Variables

### Backend (`backend/.env`)
```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/email_scheduler?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_NODE=http://localhost:9200
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_SENDS_MS=500
MAX_EMAILS_PER_HOUR=100
MAX_EMAILS_PER_HOUR_PER_SENDER=20
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=email_scheduler_super_secret_key_123
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

---

## Architectural Deep Dive

### 1. Core Scheduling without Cron
We strictly enforce **zero cron dependencies**. When a user submits an email batch:
1. Emails are written to PostgreSQL in state `SCHEDULED` with a unique `idempotencyKey`.
2. Each job is enqueued into **BullMQ** with `delay = targetScheduledTime - Date.now()`.
3. Redis stores the delayed job timer persistently. When the timer expires, BullMQ worker threads consume the job atomically.

### 2. Server Restart Durability & Idempotency
- **Durable Store**: Every scheduled job is persisted in PostgreSQL before entering BullMQ.
- **Boot Reconciliation**: On backend server boot (`src/queue/reconcile.ts`), the system queries PostgreSQL for all `SCHEDULED` or `RESCHEDULED` jobs. It cross-checks Redis/BullMQ. If Redis was restarted or flushed, missing jobs are recalculated and re-enqueued into BullMQ with exact remaining delays.
- **Idempotency**: Before sending an email, worker threads verify `emailJob.status` in DB. If already `SENT` or `PROCESSING`, the job execution is skipped, eliminating double-sends.

### 3. Per-Sender Rate Limiting & Automatic Requeueing
- **Redis Hourly Counters**: Each email attempt increments an atomic Redis key: `rate_limit:{senderEmail}:{YYYY-MM-DD-HH}` with a 2-hour TTL.
- **Threshold Check**: Evaluates sender limit (`MAX_EMAILS_PER_HOUR_PER_SENDER` or per-request limit).
- **Requeue Logic**: If limit is hit:
  1. Job status in DB is updated to `RESCHEDULED`.
  2. Target execution time is set to `getStartOfNextHour()`.
  3. Job is re-added to BullMQ delayed queue for the next hour window, preserving relative sequence.
  4. Slack alert is dispatched instantly.

### 4. Live Slack Alerts
- Supports full **Slack OAuth 2.0** flow (`GET /api/slack/auth`) and **Incoming Webhook** configurations.
- When any sender hits their hourly quota, a live Slack message is dispatched with sender email, rate limit cap, number of affected jobs, and next execution window.
- Gracefully skips notification if user has not connected Slack, preventing app crashes.

---

## Requirements Verification Checklist

- [x] **No cron used anywhere** (Only BullMQ delayed jobs + DB recovery).
- [x] **Survives server restart** (Future-scheduled emails fire at correct time; idempotency key guards duplicate sends).
- [x] **Multiple senders supported** (Individually tracked & rate-limited).
- [x] **Configurable worker concurrency** (`WORKER_CONCURRENCY` env variable).
- [x] **Per-sender Redis hourly counters** (`INCR` with 2h TTL).
- [x] **Requeue-on-limit logic** (Reschedules excess emails into next hour window).
- [x] **Slack OAuth & live notifications** (Real API/webhook dispatch on limit hit).
- [x] **Elasticsearch search** (Full-text query over subject, recipient, sender, body + DB fallback).
- [x] **Bull Board UI** (Mounted live at `/admin/queues`).
- [x] **Next.js Frontend with Google OAuth** (Google provider + instant test credentials fallback).
- [x] **CSV Lead Parser** (Client-side CSV parsing with detected email preview).
- [x] **Scheduled & Sent Tables** (Filterable, auto-refreshing, with loading & empty states).

---

## Explicit Assumptions & Trade-Offs

1. **Figma Design**: No pixel-perfect Figma design was provided, so modern glassmorphic Tailwind CSS UI patterns (Inter font, subtle shadows, status badges) were chosen.
2. **Elasticsearch Indexing**: Elasticsearch runs in single-node mode via Docker. If Elasticsearch is offline or indexing is delayed, the search endpoint gracefully falls back to PostgreSQL ILIKE fuzzy search.
3. **Slack Setup**: Slack OAuth requires registering a Slack App with redirect URL `http://localhost:4000/api/slack/callback`. A direct Incoming Webhook modal is provided in the dashboard header for instant local testing without creating a public app domain.
4. **Google OAuth**: Google OAuth Client ID is required for real Google logins. A "Demo Account" button is provided on `/login` so reviewers can test the application without registering OAuth test accounts in GCP Console.
