# FitsYou — Fashion Social + AI Virtual Try-On Platform

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)]()
[![Vitest Tests](https://img.shields.io/badge/Vitest-17%20Passed-success)]()
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL%2018-blue)]()
[![Fastify](https://img.shields.io/badge/Backend-Fastify%205%20%2B%20TypeScript-black)]()
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Tailwind-61dafb)]()

FitsYou is a social fashion platform and virtual try-on studio. Users upload a full-body reference photo and their height to derive an **anthropometric body MAP** (proportions and 2D landmarks—**no 3D mesh, no model training**). Users discover runway looks, build outfits with hotspot pins linked to real catalog products, simulate realistic virtual try-ons via Gemini AI, and publish outfits to a social feed.

---

## 1. System Architecture

```mermaid
graph TD
    Client["React 19 + Vite Frontend (Port 5173)"]
    API["Fastify 5 + TypeScript API (Port 3000)"]
    Neon[("Neon Lakebase Postgres 18\n(1,000 Products, 5,879 Images)")]
    Worker["Background Worker\n(Standalone / Render Worker)"]
    Cron["Hourly Trending Cron"]
    Gemini["Google GenAI\n(Imagen 3 / Gemini 2.5 Flash)"]
    Supabase["Supabase Storage / Auth"]

    Client -->|REST & CORS| API
    API -->|Prisma Client (Pooled)| Neon
    Worker -->|Prisma Client (Direct)| Neon
    Cron -->|Recalculate Decay Velocity| Neon
    Worker -->|Multimodal Prompt| Gemini
    API -->|Photo Uploads| Supabase
```

---

## 2. Key Heuristic Engines (Zero Heavy ML)

### 2.1 Personalized Match Score Heuristic
The recommendation engine computes a tailored compatibility score ($70\% - 99\%$) by evaluating 4 pure, testable heuristic dimensions:
$$\text{MatchScore} = (0.25 \cdot \text{HeightScore}) + (0.30 \cdot \text{BodyTypeScore}) + (0.25 \cdot \text{FitScore}) + (0.20 \cdot \text{StyleVibeScore})$$

1. **Height Proportion Score (25%):** Automatically parses the garment model's height from catalog `rawDetails` (e.g. `5'8` $\to 173\text{ cm}$) and computes relative drape variance.
2. **Body Type Affinity Matrix (30%):** Matches silhouette classifications (`hourglass`, `athletic`, `rectangle`, `inverted_triangle`, `round`) with garment tailoring (e.g., `crop top` on `hourglass` = $95\%$).
3. **Fit Preference Alignment (25%):** Compares user preference (`fitted`, `regular`, `relaxed`, `oversized`) against garment cut.
4. **Style Vibe Match (20%):** Assesses keyword overlap across occasion, tags, and user aesthetic.

### 2.2 Trending Velocity Score with Exponential Decay
Engagement scores decay dynamically over a 24-hour half-life so viral runway looks stay fresh:
$$\text{RawScore} = (\text{Views} \times 0.1) + (\text{Likes} \times 1.5) + (\text{Shares} \times 3.0) + (\text{TryOns} \times 4.5)$$
$$\text{Velocity} = \text{RawScore} \times 0.5^{(\text{AgeHours} / 24)}$$

### 2.3 Anthropometric Body MAP Derivation
Extracts physical dimensions in cm (`shoulderWidth`, `bustChest`, `waist`, `hips`, `torsoHeight`, `legInseam`) and normalized 2D skeletal landmarks:
- **Zero 3D meshes**
- **Zero heavy model training**
- Pure geometric ratios combined with Gemini multimodal prompt structuring.

---

## 3. Getting Started Locally

### Prerequisites
- Node.js `v20+` or `v22+`
- npm `10+`

### 1. Clone & Install Dependencies
```bash
# In repository root
npm install

# In backend server
cd server
npm install
cd ..
```

### 2. Configure Environment (`server/.env`)
Create `server/.env`:
```env
DATABASE_URL="postgresql://neondb_owner:<password>@ep-wandering-smoke-azjrk9ym-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:<password>@ep-wandering-smoke-azjrk9ym.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
PORT=3000
NODE_ENV=development
GEMINI_API_KEY="" # Optional: activates live Imagen 3 generation; realistic fallback enabled if blank
```

### 3. Run Migrations & Seed
```bash
npm run server:seed
```

### 4. Run Both Servers Concurrently
Open two terminals:

```bash
# Terminal 1: Backend API (Port 3000)
npm run server:dev

# Terminal 2: React Frontend (Port 5173)
npm run dev
```

Visit **`http://localhost:5173`** to interact with the platform.

### 5. Running the Automated Test Suite
```bash
npm run server:test
```
*(Runs 17 Vitest unit & integration tests across heuristics, try-on queues, and API routes).*

---

## 4. Deploying to Render

The repository includes a ready-to-deploy **[`render.yaml`](file:///d:/realmhack/render.yaml)** blueprint defining all 3 required services:

1. **Web Service (`fitsyou-api`):** Fastify REST API, Docker runtime, health check at `/api/health`.
2. **Background Worker (`fitsyou-tryon-worker`):** Autonomous try-on pipeline processor (`node dist/worker.js`, 2 instances).
3. **Hourly Cron (`fitsyou-trending-cron`):** Hourly task recalculating viral velocity scores (`node dist/cron/recalculateTrending.js`).

### Deploy Steps:
1. Push this repository to GitHub.
2. In Render Dashboard, click **New > Blueprint**.
3. Select your repository—Render will automatically configure the Web Service, Worker, and Cron Job from `render.yaml`.
4. Add your `DATABASE_URL`, `DIRECT_URL`, and `GEMINI_API_KEY` in the Render environment variables dashboard.

---

## 5. API Reference

### Health & System
- `GET /api/health` — Service health, database latency, and memory metrics.

### Social Feed
- `GET /api/v1/posts?tab=all&category=casual&page=1&limit=20` — Social feed with hotspot product pins.
- `GET /api/v1/posts/:id` — Single post details.
- `POST /api/v1/posts/:id/like` — Atomic like/unlike toggle.
- `POST /api/v1/posts` — Create a new post.

### Runway & Recommendations
- `GET /api/v1/trending?category=all&limit=20` — Viral looks ranked by velocity with rank badges (`#1 WORLDWIDE`).
- `GET /api/v1/for-you?userId=...` — Personalized recommendations with dynamic match scores & fit notes.

### Product Catalog
- `GET /api/v1/products?q=shirt&wearableOnly=true` — Catalog search with size & price filters.
- `GET /api/v1/products/:id` — Product specifications & physical measurements from `rawSizes`.

### Virtual Try-On Pipeline
- `POST /api/v1/try-on` — Submit try-on request (returns `{ jobId, tryOnSessionId, status: "QUEUED" }`).
- `GET /api/v1/try-on/jobs/:jobId` — Poll status (`QUEUED` $\to$ `PROCESSING` $\to$ `COMPLETED`).
- `GET /api/v1/try-on/sessions?userId=...` — Saved try-on looks wardrobe.
- `GET /api/v1/try-on/sessions/:id` — Session breakdown and Body MAP coordinates.
- `PUT /api/v1/try-on/sessions/:id` — Toggle privacy (`isPrivate`) or save state.

### User & Body Profile
- `GET /api/v1/users/:id` — User profile, stats (posts, followers, tryOns), and body profile.
- `PUT /api/v1/users/:id/body-profile` — Update measurements (height, body type, preferences).

---

## 6. Hackathon Presentation & Demo Script

### Suggested 3-Minute Demo Walkthrough:
1. **The Problem:** Online fashion shoppers struggle with fit uncertainty and generic social feeds detached from buyable catalog inventory.
2. **The Discovery Feed (`/`):**
   - Show interactive Instagram-style post cards.
   - Tap the **Hotspot Pins** on a post—show how it links directly to real Myntra catalog items with real pricing and dimensions.
   - Tap the **Heart** button—demonstrate atomic live like toggling synced to PostgreSQL.
3. **The Trending Runway (`/trending`):**
   - Filter by categories (`Ethnic Wear`, `Streetwear`, `Party Glam`).
   - Highlight the **`#1 WORLDWIDE`** badge driven by our exponential time-decay velocity algorithm.
4. **AI Virtual Try-On Studio (`/try-on`):**
   - Click **"Change Garment"** to browse the real 1,000-item Myntra catalog.
   - Select a garment (e.g., *KETCH Slim Fit Checked Shirt* or *Stylecast Crop Top*).
   - Watch the animated calibration bar derive the **Body MAP** (shoulders, chest, waist ratios) without intrusive 3D scans.
   - Show the completed fitting result with **Fit Score (94%)** and tailored explanation (*"Ideal length match for your 180cm frame"*).
   - Toggle the **"Original Photo vs. Virtual Try-On"** slider.
5. **Personalized Recommendations (`/for-you`):**
   - Show how the algorithm ranks outfits uniquely based on the user's specific measurements and aesthetic preference.
6. **Wardrobe Vault (`/profile`):**
   - Show saved try-ons.
   - Tap the **Private / Public** pill to demonstrate real-time permission toggles.
   - Open **"Body Profile"** to tweak height or silhouette and watch recommendations update live.
