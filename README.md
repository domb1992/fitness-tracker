# FitTrack

A mobile-first gym workout tracker. Log sets, track weight progression per exercise, visualise your monthly training calendar, and share your progress — built with React and Supabase.

---

## Features

### Workout planning
- **Training plans** — Create and manage any number of plans, each with ordered exercises, set counts, and target reps (supports numbers or `max`)
- **Exercise configuration** — Optional seat position and notes per exercise, displayed as reminders during the live workout
- **Muscle recognition** — Automatic muscle assignment from a local database of 60+ exercises (English + German names, aliases, fuzzy matching); shows primary and secondary muscles as colour-coded chips; manual override with an inline muscle picker; re-detect button if the name changes
- **Plan editing** — Add, reorder, and delete exercises; change plan name, description, and colour; delete a plan from the Danger Zone

### Live workout
- **Active session** — Real-time elapsed timer, per-set weight and rep logging, add or remove sets on the fly
- **Warmup exercises** — Optional warmup exercises (e.g. treadmill, rowing) always appear before strength exercises; log actual duration (min) and pulse (BPM) instead of weight/reps; doesn't trigger the rest timer
- **Smart pre-fill** — Weights and reps from your last session are shown as grey placeholders; confirmed automatically if you leave a field blank
- **Rest timer** — Countdown with quick presets (1:00 / 1:30 / 2:00 / 3:00) and a custom duration picker; auto-starts after each logged set; last-used duration persists across sessions
- **Progress indicator** — Active exercises float above completed ones; a sticky Finish button is always visible above the completed group
- **Offline mode** — Finishing a workout without a connection saves it locally and syncs automatically when you come back online; a banner tracks sync status on the dashboard

### History & progress
- **Session history** — Browse past workouts; edit individual weights, reps, or the session date; delete sessions
- **Progress page** — Monthly calendar heatmap (week starts Monday), streak counter with up to 2 rest-days grace, per-exercise weight progression (first → latest → diff → personal best), swipe or tap the arrows to move between months
- **Exercise detail** — Weight-over-time bar chart and full session history with per-set breakdown
- **Share** — Native share sheet on mobile (Web Share API) or clipboard fallback on desktop; available on session view and progress summary

### Dashboard analytics
- **Volume by Muscle Group** — Horizontal bar chart of weighted sets per muscle for any month; primary muscles count ×1.0, secondary ×0.5; warmup exercises excluded; swipe or tap arrows to navigate months
- **Lift Progression** — Per-exercise cards showing start weight → current weight, kg gained/lost badge, training period (weeks), and a sparkline; sorted best progress first; taps through to exercise detail

### Auth & profile
- **Authentication** — Email/password sign-up and login, password-reset email flow, in-app password update
- **Profile management** — Edit display name and email address; direct in-app password change with strength indicator and show/hide toggles; email-reset link as an alternative

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Routing | React Router DOM v6 |
| State | Zustand (active workout session persisted to `localStorage`) |
| Backend / DB | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth |
| Styling | Tailwind CSS + CSS custom design-token system |
| Hosting | Netlify |

---

## Project Structure

```
fitness-tracker/
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts           Supabase query wrappers (auth, plans, exercises, sessions)
│   │   ├── components/
│   │   │   ├── ActiveWorkoutBar.tsx  Sticky resume bar shown outside the workout page
│   │   │   ├── BottomNav.tsx         Mobile bottom navigation (Dashboard / Progress / Profile)
│   │   │   ├── ConfirmDialog.tsx     Generic confirm modal
│   │   │   └── ErrorBoundary.tsx     Top-level error boundary
│   │   ├── hooks/
│   │   │   ├── useOnlineStatus.ts    Online/offline detection
│   │   │   └── useRestTimer.ts       Countdown timer with localStorage persistence
│   │   ├── lib/
│   │   │   ├── supabase.ts           Supabase client initialisation
│   │   │   └── exerciseDatabase.ts   Local exercise DB (60+ exercises), fuzzy matcher, fixed muscle list
│   │   ├── pages/
│   │   │   ├── AuthPage.tsx          Sign-up / login
│   │   │   ├── UpdatePasswordPage.tsx  Password reset via email link
│   │   │   ├── DashboardPage.tsx     Plan listing, week strip, recent sessions, offline banner
│   │   │   ├── SetupPage.tsx         First-time onboarding / new plan wizard
│   │   │   ├── EditPlanPage.tsx      Edit exercises, order, name, colour
│   │   │   ├── WorkoutPage.tsx       Active workout session with rest timer
│   │   │   ├── SessionPage.tsx       View / edit a completed session
│   │   │   ├── ExerciseDetailPage.tsx  Weight chart + per-session history
│   │   │   ├── ProgressPage.tsx      Calendar heatmap, streaks, exercise progression
│   │   │   └── SettingsPage.tsx      Profile, email, password management
│   │   ├── store/
│   │   │   └── store.ts              Zustand store (auth + active workout)
│   │   ├── types/
│   │   │   └── index.ts              Shared TypeScript interfaces
│   │   ├── App.tsx                   Root component and route definitions
│   │   └── index.css                 Global styles and design-token system
│   ├── index.html
│   └── package.json
├── supabase/
│   ├── schema.sql                Tables, indexes, RLS policies, and RPC functions
│   ├── add_exercise_fields.sql   Migration: seat_position / notes columns + idempotent RPC
│   ├── add_warmup_fields.sql     Migration: exercise_type / planned_duration_minutes + updated stats RPC
│   ├── add_muscle_fields.sql     Migration: primary_muscles / secondary_muscles / movement_pattern / equipment / muscle_source
│   └── add_analytics_rpcs.sql   Migration: get_monthly_muscle_volume RPC + first/last logged dates in get_workout_stats
├── netlify.toml
└── README.md
```

---

## Local Development

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/your-username/fitness-tracker.git
cd fitness-tracker
npm install --prefix frontend
```

### 2. Configure environment variables

Create `frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are in your Supabase project under **Settings → API**.

### 3. Set up the database

Open the **SQL Editor** in your Supabase dashboard and run the files in order:

1. **`supabase/schema.sql`** — creates all tables, enables Row Level Security, and registers the RPC functions
2. **`supabase/add_exercise_fields.sql`** — adds `seat_position` and `notes` columns to exercises and replaces `complete_workout` with an idempotent version safe for offline retries
3. **`supabase/add_warmup_fields.sql`** — adds `exercise_type` and `planned_duration_minutes` columns; updates `get_workout_stats` to exclude warmup exercises from weight progression stats
4. **`supabase/add_muscle_fields.sql`** — adds `primary_muscles`, `secondary_muscles`, `movement_pattern`, `equipment`, and `muscle_source` columns
5. **`supabase/add_analytics_rpcs.sql`** — creates `get_monthly_muscle_volume` RPC; updates `get_workout_stats` with `first_logged_at` / `last_logged_at` per exercise for the Lift Progression dashboard section

> All migration files use `ADD COLUMN IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION`, so they are safe to run on an existing database.

### 4. Configure Auth redirect URLs

In **Supabase → Authentication → URL Configuration**, add:

```
http://localhost:5173/update-password
https://your-netlify-site.netlify.app/update-password
```

### 5. Start the dev server

```bash
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Database Schema

All tables are in Supabase (PostgreSQL). Full definitions are in [`supabase/schema.sql`](supabase/schema.sql).

### Tables

| Table | Description |
|---|---|
| `training_plans` | User-owned plans with name, description, colour, and display order |
| `exercises` | Ordered exercises per plan — `sets`, `target_reps` (TEXT, supports `max`), optional `seat_position` and `notes`; `exercise_type` (`strength` \| `warmup`); `planned_duration_minutes` for warmup |
| `workout_sessions` | One row per session; `completed_at` is set when the workout is finished |
| `set_logs` | Per-set results — `weight_kg` (REAL, nullable), `reps_completed` (TEXT, nullable); for warmups: `weight_kg` = pulse BPM, `reps_completed` = actual duration |

### RPC Functions

| Function | Description |
|---|---|
| `complete_workout(session_id, notes, duration_secs, set_logs_jsonb)` | Atomically inserts all set logs and marks the session complete; idempotent — safe to retry after a network failure |
| `get_workout_stats()` | Returns total workouts, last-7-days count, per-exercise weight progression, and `first_logged_at` / `last_logged_at` dates per exercise |
| `get_exercise_history(exercise_id)` | Returns per-session set details and best weight for a single exercise |
| `get_monthly_muscle_volume(year, month)` | Returns weighted set counts per muscle for the given month; primary ×1.0, secondary ×0.5; warmup exercises excluded |

Row Level Security is enabled on all tables — users can only access their own data.

### Migrations

**Adding exercise fields to an existing database:**

```sql
-- supabase/add_exercise_fields.sql
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS seat_position TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes         TEXT NOT NULL DEFAULT '';
```

**Migrating `reps` columns from `INTEGER` to `TEXT`** (required for `max` reps support):

```sql
ALTER TABLE exercises
  ALTER COLUMN target_reps TYPE TEXT USING target_reps::TEXT;
ALTER TABLE exercises
  ALTER COLUMN target_reps SET DEFAULT '10';

ALTER TABLE set_logs
  ALTER COLUMN reps_completed TYPE TEXT USING reps_completed::TEXT;
```

Then re-run the `complete_workout` and `get_exercise_history` function definitions from `schema.sql`.

---

## Deployment (Netlify)

The `netlify.toml` at the repo root is pre-configured:

```toml
[build]
  base    = "frontend"
  command = "npm install && npm run build"
  publish = "dist"
```

**Steps:**

1. Push this repo to GitHub
2. Connect the repo to a new Netlify site — it auto-detects `netlify.toml`
3. Add environment variables under **Netlify → Site configuration → Environment variables**:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

4. Add your Netlify URL to the Supabase Auth redirect allow-list (see step 4 above)
5. Deploy

> The anon key is safe to expose in the frontend — Supabase RLS ensures each user can only read and write their own data.

---

## License

MIT
