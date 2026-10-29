# FitsYou — Fashion Social + AI Virtual Try-On Platform

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)]()
[![Vitest Tests](https://img.shields.io/badge/Vitest-77%20Passed-success)]()
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL-blue)]()
[![Backend](https://img.shields.io/badge/Backend-Fastify%205%20%2B%20TypeScript-black)]()
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61dafb)]()

FitsYou is a social fashion platform and AI virtual try-on studio. Users upload a reference photo and physical measurements to generate a tailored **anthropometric body MAP** (proportions and 2D skeletal landmarks—**no 3D mesh, no heavy model training**). Users discover runway looks, build outfits with hotspot pins linked to real catalog products, simulate virtual try-ons via multimodal Gemini AI, and browse personalized recommendations cached with sub-500ms latency.

---

## 1. System Architecture

```mermaid
graph TD
    Client["React 19 + Vite Frontend (Port 5173)\nClerk Auth + Vanilla CSS Tokens"]
    API["Fastify 5 + TypeScript API (Port 3000)\nAuth Middleware + Rate Limiting"]
    Neon[("Neon PostgreSQL\n(Products, Looks, FeedCache, Users)")]
    Worker["Try-On Worker\n(Inline Dev or Standalone Process)"]
    Gemini["Google GenAI API\n(Gemini 2.5 Flash Image)"]
    Clerk["Clerk Authentication\n(JWT Verification)"]

    Client -->|REST & Bearer Token| API
    Client -->|Clerk Components & Tokens| Clerk
    API -->|JWT Public Key Verify| Clerk
    API -->|Prisma Client (Pooled)| Neon
    API -.->|Inline Job Spawn (INLINE_WORKER=true)| Worker
    Worker -->|Prisma Direct (Atomic claimJob)| Neon
    Worker -->|Multimodal Try-On Prompt| Gemini
```

---

## 2. Key Subsystems & Heuristics

### 2.1 Virtual Try-On Pipeline & Worker
- **Two Execution Modes**:
  - `TRYON_MODE=demo` (Default): Uses high-fidelity, photorealistic composite rendering with instantaneous execution (~500ms–1s). Guaranteed reliability for demos, judging, and automated test suites without quota limits or network flakiness.
  - `TRYON_MODE=live`: Calls Google GenAI (`@google/genai` SDK) using `gemini-2.5-flash-image` with `responseModalities: ["TEXT", "IMAGE"]`. Fetches person and garment images with a 10s timeout, encodes inline base64 parts, and renders try-on results. Fails loudly on startup or session submission if `GEMINI_API_KEY` is missing.
- **Atomic Job Claiming (`claimJob`)**:
  Concurrency-safe database lock `updateMany({ where: { id, status: "QUEUED" }, data: { status: "PROCESSING", lockedAt, lockedBy, startedAt, attempts: { increment: 1 } } })`. Guarantees multiple concurrent workers never process the same try-on job twice.
- **Inline Worker for Local Dev (`INLINE_WORKER=true`)**:
  Automatically spawns worker execution via `setImmediate` in the server process when a job is queued, eliminating the need to run a separate terminal for `worker.ts` during development.

### 2.2 Fast For You Recommender (`FeedCache`)
- **Database Schema**:
  Composite primary key `@@id([userId, category])` storing precomputed match scores and fit notes `items: [{ postId, score, fitNote }]`.
- **Stale-While-Revalidate**:
  - **Cache Hit (Fresh)**: Returns immediately from DB cache in **< 500ms** (measured ~350–440ms server-side).
  - **Cache Hit (Stale)**: If older than `FEED_STALE_HOURS` (default 6h), returns cached items immediately (`isStale: true`) and recomputes fresh rankings in the background via `setImmediate`.
  - **New User / No Cache**: Immediately returns a starter feed of trending & recent looks (`isStarter: true`) and generates personalized recommendations in the background.
- **SQL Candidate Prefiltering & Fast Hydration**:
  Filters candidate looks at the database level by category and audience gender before scoring. Hydrates posts in a single query loading only `ProductImage: { take: 1, orderBy: { position: "asc" } }` while omitting heavy raw JSON columns.
- **Occasion Categories**:
  Supports category chips (All, Streetwear, Casual, Office wear $\to$ `formal`, Ethnic wear, Party wear, Dresses, College outfits), each maintaining its own independent cache key.
- **Layout Stability**:
  If background recomputation changes the post order, a non-intrusive floating *"New picks available"* pill appears so content never shifts under the user while browsing.

### 2.3 Search Engine
- Server-side search across `/api/v1/posts?q=`, `/api/v1/trending?q=`, `/api/v1/for-you?q=`, `/api/v1/products?q=`, and `/api/v1/users/search?q=`.
- Matches case-insensitively across post captions, tags, categories, creator names/handles, and tagged product names/brands.
- Frontend queries are debounced (300ms) with monotonic request ID guards to discard stale responses when the user types quickly.
- Search overlay provides dedicated **Looks**, **Products**, and **Creators** tabs with live counts, loading skeletons, and empty states.

---

## 3. Environment Variables

### Frontend (`.env` in repository root)
| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | No | `http://localhost:3000` | Backend API base URL |
| `VITE_USE_MOCKS` | No | `false` | Fall back to client mocks if backend is unreachable |
| `VITE_CLERK_PUBLISHABLE_KEY` | Optional | `""` | Clerk publishable key for real user authentication. If omitted, app falls back to seamless demo mode |

### Backend (`server/.env`)
| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | — | Neon PostgreSQL connection string (pooled) |
| `DIRECT_URL` | Optional | — | Direct Neon connection string for migrations |
| `TEST_DATABASE_URL` | Optional | — | Dedicated database connection string for running test suites |
| `PORT` | No | `3000` | API port |
| `NODE_ENV` | No | `development` | Set to `production` in deployed environments |
| `TRYON_MODE` | No | `demo` | `demo` for photorealistic mock render, `live` for Google Gemini |
| `GEMINI_API_KEY` | If `TRYON_MODE=live` | `""` | Google Gemini API key |
| `GEMINI_IMAGE_MODEL`| No | `gemini-2.5-flash-image` | Model identifier for multimodal image generation |
| `INLINE_WORKER` | No | `true` | When `true`, server runs try-on jobs inline without needing a separate worker process |
| `FEED_STALE_HOURS` | No | `6` | Hours before a cached For You feed is considered stale |
| `DEBUG_TIMING` | No | `false` | When `true`, prints per-step latency logs (candidate query, scoring, cache write, hydration) |
| `CLERK_SECRET_KEY` | Optional | `""` | Clerk backend secret key |
| `CLERK_PUBLISHABLE_KEY` | Optional | `""` | Clerk backend publishable key |
| `AUTH_DEMO_MODE` | No | `true` | Allows local development without Clerk keys. **Forbidden in production** (`NODE_ENV=production` refuses to boot if enabled) |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed origins |

---

## 4. Getting Started Locally

### Prerequisites
- Node.js `v20+` or `v22+`
- npm `10+`

### 1. Install Dependencies
```bash
# In repository root (installs frontend and backend dependencies)
npm install
cd server && npm install && cd ..
```

### 2. Configure Environment Files
Copy example configuration files:
```bash
# Frontend
cp .env.example .env

# Backend
cp server/.env.example server/.env
```
Add your Neon PostgreSQL connection string to `DATABASE_URL` in `server/.env`.

### 3. Initialize & Seed Database
```bash
# Generates Prisma client, applies schema, seeds 1,000 products, 42 looks, and pre-warms feed caches
npm run server:seed
```

### 4. Run Both Servers Concurrently
Open two terminal windows:

```bash
# Terminal 1: Backend Fastify API (Port 3000)
npm run server:dev

# Terminal 2: React 19 Frontend (Port 5173)
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

> [!TIP]
> If you set `INLINE_WORKER=false` to test a production-like decoupled worker, start the worker in a third terminal:
> ```bash
> cd server && npx tsx src/worker.ts
> ```

---

## 5. Automated Testing

Run the full automated test suite:
```bash
npm run server:test
```

### Test Suite Summary (**77 passing tests across 8 suites**):
- **`phase5Search.test.ts` (10 tests)**: Verifies `q` parameter across `/posts`, `/trending`, `/for-you`, `/products`, and `/users/search`, case-insensitivity, creator matching, and empty states.
- **`phase4FeedCache.test.ts` (7 tests)**: Verifies sub-500ms cache hits, stale-while-revalidate background refresh, new user starter feeds, per-category cache keys, and body profile update recomputation.
- **`integration.test.ts` (8 tests)**: Full end-to-end user workflows, post creation, likes, trending rankings, product catalogs, and try-on queueing.
- **`phaseA.test.ts` (13 tests)**: User ownership guards (`/me`), try-on privacy checks, signed photo upload consent, and worker concurrency safety.
- **`phaseB.test.ts` (11 tests)**: Anthropometric body profile measurement calibration and ease-based fit recommendations.
- **`phaseC.test.ts` (14 tests)**: Post creation, social follow graph, saved items collection, and diversification algorithms.
- **`tryOn.test.ts` (8 tests)**: Atomic `claimJob` concurrency and demo mode failure handling.
- **`scoring.test.ts` (6 tests)**: Match scoring heuristics and exponential decay velocity math.

---

## 6. Deployment Configuration (`render.yaml`)

The repository includes a production-ready **[`render.yaml`](file:///d:/realmhack/render.yaml)** specification configured for:
1. **API Web Service (`fitsyou-api`)**: Fastify REST API with Dockerfile runtime, health check at `/api/health`.
2. **Background Worker (`fitsyou-tryon-worker`)**: Dedicated try-on job processor (`node dist/worker.js`).
3. **Frontend Static Site (`fitsyou-web`)**: Static Vite production bundle (`dist/`).

All sensitive secrets (`DATABASE_URL`, `CLERK_SECRET_KEY`, `GEMINI_API_KEY`) are marked with `sync: false` to ensure they are configured securely via the dashboard and never committed to version control.

---

## 7. API Reference

### Health & Discovery
- `GET /api/health` — Service health, database latency, and system memory metrics.
- `GET /api/v1/posts?tab=all&category=casual&q=shirt` — Fashion social feed with case-insensitive search and product pins.
- `GET /api/v1/trending?category=all&q=streetwear` — Looks ranked by velocity scores.
- `GET /api/v1/for-you?category=all&q=formal&refresh=false` — Fast cached personalized feed with sub-500ms latency.

### Catalog & Search
- `GET /api/v1/products?q=shirt&wearableOnly=true` — Catalog search filtered by wearable apparel.
- `GET /api/v1/products/:id/fit` — Area-by-area ease fit analysis (chest, waist, hips, length).
- `GET /api/v1/users/search?q=ananya` — Stylist & creator search.

### Virtual Try-On Pipeline
- `POST /api/v1/try-on` — Submit try-on job (`{ jobId, tryOnSessionId, status: "QUEUED" }`).
- `GET /api/v1/try-on/jobs/:jobId` — Poll status (`QUEUED` $\to$ `PROCESSING` $\to$ `COMPLETED` / `FAILED`).
- `GET /api/v1/try-on/sessions` — User's saved try-ons.
- `PUT /api/v1/try-on/sessions/:id` — Update try-on visibility (`PUBLIC` / `PRIVATE`).

### User & Body Profile
- `GET /api/v1/users/me` — Authenticated user profile and body measurements.
- `PUT /api/v1/users/:id/body-profile` — Update physical measurements (triggers instant background feed recomputation).
