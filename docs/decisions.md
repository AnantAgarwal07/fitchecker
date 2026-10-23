# FitsYou Architecture & Implementation Decisions (VERIFY Log)

Documenting verification findings for PRD Phase A, B, C, D.

---

## 1. Catalog Sizing Audit (B3 & D3 VERIFY)
Inspected 60+ real products from Neon PostgreSQL (`Product.rawSizes`).

### Findings
1. **Data Structure:**
   `Product.rawSizes` is an array of size-attribute records:
   ```json
   [
     { "size": "M", "value": "36.0in", "value_name": "To Fit Bust" },
     { "size": "M", "value": "15.5in", "value_name": "Front Length" },
     { "size": "M", "value": "32.5in", "value_name": "To Fit Waist" }
   ]
   ```

2. **Units:**
   - All dimensional values consistently use **inches** with the suffix `in` (e.g. `38.0in`, `17.13in`, `28.08in`).
   - Conversion ratio to metric: $1\text{ in} = 2.54\text{ cm}$.

3. **Measurement Nature (Circumference vs Linear):**
   - **Chest / Bust / To Fit Bust:** **Full circumference** in inches. (e.g. `38.0in` $\to 96.52\text{ cm}$).
   - **Waist / To Fit Waist:** **Full circumference** in inches. (e.g. `30.0in` $\to 76.2\text{ cm}$).
   - **Hips:** **Full circumference** in inches. (e.g. `36.0in` $\to 91.44\text{ cm}$).
   - **Across Shoulder:** **Linear width** seam-to-seam. (e.g. `17.0in` $\to 43.18\text{ cm}$).
   - **Front Length:** **Linear vertical length** from collar/shoulder to hem. (e.g. `28.0in` $\to 71.12\text{ cm}$).
   - **Inseam Length:** **Linear inner leg length** from crotch to ankle hem. (e.g. `32.0in` $\to 81.28\text{ cm}$).

4. **Handling Ambiguous or Non-Wearable Products:**
   - Products with only `{ "size": "Onesize" }` (e.g. sarees, watches, necklaces) have no chest/waist/length chart.
   - **Rule:** For any product where no valid chest, waist, length or inseam numbers exist, `Product.sizeChart` remains `null`. When `sizeChart` is `null`, `fitReport` returns `null` and `measuredFit: false`. No fabricated numbers.

---

## 2. Gemini Generative AI Model Verification (A1 VERIFY)
1. **Imagen 3 Status:**
   - Google deprecated `imagen-3.0-generate-002` via Google AI Studio and restricted `generateImages` to Vertex AI / Gemini Enterprise Agent Platform.
   - Calling `generateImages` on free Google AI Studio keys returns:
     `"This method is only supported by the Gemini Enterprise Agent Platform (previously known as Vertex AI)"`
     or `429 Quota Exceeded (limit: 0 on free tier)`.

2. **Model Selection:**
   - Use Gemini multimodal image model family (e.g. `gemini-2.5-flash-image` or `gemini-3.1-flash-image`), parameterized via `process.env.GEMINI_IMAGE_MODEL`.
   - Default: `gemini-2.5-flash-image` (configurable via `GEMINI_IMAGE_MODEL`).
   - `TRYON_MODE`: `live` | `demo`.
   - In `live` mode, never silently switch to demo mode. If quota is exceeded or billing is not enabled, return a typed error:
     - `IMAGE_GENERATION_QUOTA_EXCEEDED` (HTTP 429)
     - `IMAGE_GENERATION_BILLING_REQUIRED` (HTTP 402/400)
     - `SAFETY_BLOCKED` (HTTP 422)
   - In `demo` mode, explicit `mode: "demo"` is saved to database and returned to the client, and the UI displays a visible badge: *"Demo preview, not AI generated"*.

---

## 3. Storage and Privacy Decisions (A2)
- Provider interface: `server/src/services/storage.ts`.
- Default: Supabase Storage private bucket `user-photos` and `tryon-renders`.
- Access: Signed URLs with 15-minute expiry (`SIGNED_URL_EXPIRY_SECONDS=900`).
- No raw image bytes in PostgreSQL.
- Consent gate: `POST /api/v1/me/consent` `{ type: "photo_processing" }` required before signed upload URLs are granted.
- Privacy control: `TryOnSession.visibility` defaults to `PRIVATE`.
- Permanent deletion: `DELETE /api/v1/me/photos` and `DELETE /api/v1/try-on/:id` wipe both database rows and storage bucket objects.

---

## 4. Auth & Ownership Hardening (A3)
- Verification of Clerk JWT tokens server-side using `@clerk/backend` with `CLERK_SECRET_KEY` or JWKS.
- User mapped to PostgreSQL `User` via `clerkId`.
- In production (`NODE_ENV === "production"`), `AUTH_DEMO_MODE=true` causes the server to refuse to boot.
- Route ownership checks: writes targeting `/users/:id` or `/me/` verify `request.user.id === targetId`.
