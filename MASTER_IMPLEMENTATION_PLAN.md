# Krishi Sakhi — Master Implementation Plan
> Last updated: 2026-04-05
> Status: Voice Input (Phase 6) completed ahead of schedule. Backend foundations laid. Next focus: ML Pipelines & Camera UI.

---

## Pre-Work: What the Code Audit Actually Found

Before any implementation, understand the real current state — not what the docs say.

### Backend
- `backend/` contains only `.gitkeep` files. Zero code exists. Must be built from scratch.

### ML Services
- `ml/` contains only `.gitkeep` files. All four services (soil, crop, price, transcriber) do not exist yet.

### Frontend (live and working)
- Auth via Supabase Phone OTP: working
- `farmers`, `farms`, `ref_crops`, `ref_locations`: live DB reads/writes
- Chat: browser → Dify direct via `difyClient.js` (working if env vars set)
- `CropDiseaseDetectionCamera`: fully mocked — no real ML call
- `FarmFinanceTracker`: fully hardcoded static data — no DB call

### Schema Drift (blocking — must fix before backend build)
The frontend was built against custom interim tables that **do not match the authoritative schema**:

| Frontend uses | Schema defines | Status |
|---|---|---|
| `farm_crops` table | `crop_records` table | Mismatch — different column names |
| `activity_logs` table | No equivalent | Not in schema at all |
| `farmers.phone_number` column | Column does not exist in schema | Insert fails silently |
| `planted_date` in farm_crops | `sowing_date` in crop_records | Different name |
| Growth stages: `land_prep`, `fruiting`, `post_harvest` | Not in CHECK constraint | Constraint violation |

### Security Issue
The Dify chatflow YAML (`dify/chatflow - krishi sakhi.yml`) contains the Supabase **service role key** in plaintext. This key must be rotated before any deployment.

---

## Phase Structure Overview

```
Phase 0  Schema Reconciliation + Security Fix          (1–2 days)
Phase 1  Backend Foundation                            (3–4 days)
Phase 2  Advisory Integration (Chat → Backend)         (2–3 days)
Phase 3  ML Service Stubs + Camera Integration         (3–4 days)
Phase 4  Finance Tracker + Expense Logs                (1–2 days)
Phase 5  Weather Integration (Live Data)               (1 day)
Phase 6  Voice Input                                   (2 days)
Phase 7  ML Services Full Implementation               (5–7 days)
Phase 8  PWA Hardening + Offline                       (2–3 days)
Phase 9  Testing + Observability                       (2–3 days)
Phase 10 Pre-Deployment Checklist                      (1 day)
```

---

## Phase 0 — Schema Reconciliation + Security Fix

**Why first:** The frontend is writing to tables that don't exist in the authoritative schema. The backend cannot be built until the DB is the ground truth. Security key must be rotated before any further work.

### 0.1 Rotate the Supabase service role key

**Immediately.**

1. Go to Supabase Dashboard → Project Settings → API
2. Rotate the service role key
3. Update all `.env` files locally
4. Remove the key from `dify/chatflow - krishi sakhi.yml` — replace with an environment variable reference
5. If the repo is public: treat the old key as compromised, verify no external access occurred

### 0.2 Decide: migrate DB to schema or update schema to match frontend

Two options. Pick one.

**Option A (Recommended): Migrate DB to authoritative schema**

Write migration `019_schema_reconciliation.sql`:

```sql
BEGIN;

-- 1. Rename farm_crops → crop_records if it exists as a custom table
-- (or create crop_records if farm_crops was never applied to production DB)
-- Check what actually exists in Supabase dashboard before writing this

-- 2. Map columns:
--    farm_crops.planted_date → crop_records.sowing_date
--    farm_crops.growth_stage values need remapping:
--      land_prep → germination (closest match) OR extend CHECK constraint
--      fruiting → maturity
--      post_harvest → post-harvest

-- 3. Add activity_logs as a new tracked table (it is genuinely useful):
CREATE TABLE IF NOT EXISTS activity_logs (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id       uuid        NOT NULL REFERENCES farmers (id),
    farm_id         uuid        REFERENCES farms (id),
    crop_name       text,
    activity_type   text        NOT NULL CHECK (activity_type IN (
                                    'planting','irrigation','fertilizer','pesticide',
                                    'weeding','pruning','harvest','soil_test',
                                    'disease_alert','growth_update','other'
                                )),
    title           text        NOT NULL,
    description     text,
    date            date        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_farmer_id ON activity_logs (farmer_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_farm_id ON activity_logs (farm_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs (date);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select_own" ON activity_logs FOR SELECT
    TO authenticated USING (auth.uid() = farmer_id);
CREATE POLICY "activity_logs_insert_own" ON activity_logs FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = farmer_id);
CREATE POLICY "activity_logs_update_own" ON activity_logs FOR UPDATE
    TO authenticated USING (auth.uid() = farmer_id);
CREATE POLICY "activity_logs_delete_own" ON activity_logs FOR DELETE
    TO authenticated USING (auth.uid() = farmer_id);

-- 4. Extend crop_records growth_stage CHECK to include frontend values:
ALTER TABLE crop_records DROP CONSTRAINT IF EXISTS crop_records_growth_stage_check;
ALTER TABLE crop_records ADD CONSTRAINT crop_records_growth_stage_check
    CHECK (growth_stage IN (
        'land_prep','germination','sowing','vegetative',
        'flowering','fruiting','maturity','harvest','post-harvest','post_harvest'
    ));

-- 5. Schema.md does not have phone_number -- do NOT add it.
--    FarmerRegistrationFlow extracts phone from email workaround.
--    This is acceptable for prototype -- log as tech debt.

COMMIT;
```

**Option B: Update schema docs to ratify the interim tables**

Only choose this if the interim tables are already populated with real farmer data you cannot migrate. Document the delta in `schema.md`.

### 0.3 Update schema.md

Add `activity_logs` table definition. Update `crop_records` growth_stage CHECK constraint list. Add migration 019 to the migration order. Note `phone_number` as tech debt.

### 0.4 Update frontend to use correct column names

After DB migration:
- `AIAssistantChatScreen`: change `farm_crops` → `crop_records`, `planted_date` → `sowing_date`
- `MyFarmsAndCropsList`: same table rename
- `AddCropModal`: same + verify growth_stage values match new constraint
- `AddActivityModal`: verify column names match new `activity_logs` schema

### Phase 0 Verification Checklist
- [ ] Old service role key rotated and confirmed invalidated
- [ ] No secrets in any tracked file (grep for `eyJ` in repo)
- [ ] `activity_logs` table exists in Supabase with RLS
- [ ] `crop_records` growth_stage values accepted by DB constraint
- [ ] Frontend can add a crop without a DB error
- [ ] Frontend can log an activity without a DB error
- [ ] `schema.md` matches live DB

### Phase 0 Doc Updates
- `schema.md`: add `activity_logs`, fix constraints, add migration 019
- `.agent-local/logs/CHANGE_LOG.md`: log all changes with rationale
- `.agent-local/state/ACTIVE_STATUS.md`: update current state

---

## Phase 1 — Backend Foundation

**Goal:** A running FastAPI backend with auth, config, and all non-advisory CRUD endpoints. No Dify integration yet.

### 1.1 Project scaffold

```
backend/
├── main.py
├── config.py
├── dependencies.py
├── requirements.txt
├── .env.example
├── routers/
│   ├── __init__.py
│   ├── farms.py
│   ├── crops.py
│   ├── expenses.py
│   └── activity.py
├── services/
│   ├── __init__.py
│   ├── weather_client.py
│   └── audit_writer.py          (stub only in Phase 1)
├── models/
│   ├── __init__.py
│   ├── farmer.py
│   ├── farm.py
│   ├── crop.py
│   ├── expense.py
│   ├── activity.py
│   └── common.py
└── docs/
    ├── API.md
    └── backend_doc.md
```

### 1.2 requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
supabase==2.7.4
httpx==0.27.0
pydantic-settings==2.3.0
python-multipart==0.0.9
```

### 1.3 config.py (exact)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    dify_api_url: str
    dify_api_key: str
    soil_classifier_url: str = "http://localhost:8001"
    crop_recommender_url: str = "http://localhost:8002"
    price_forecaster_url: str = "http://localhost:8003"
    transcriber_url: str = "http://localhost:8004"
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    advisory_timeout_seconds: int = 8
    ml_timeout_seconds: int = 5
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    class Config:
        env_file = ".env"

settings = Settings()
```

### 1.4 main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import farms, crops, expenses, activity

app = FastAPI(title="Krishi Sakhi API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(farms.router, prefix="/api/v1")
app.include_router(crops.router, prefix="/api/v1")
app.include_router(expenses.router, prefix="/api/v1")
app.include_router(activity.router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 1.5 dependencies.py

Auth dependency that validates the JWT from the Supabase anon client and returns the farmer's UUID. This is the `get_current_farmer` dependency used by every protected endpoint.

```python
from fastapi import Header, HTTPException, Depends
from supabase import create_client, Client
from config import settings
from uuid import UUID

def get_supabase() -> Client:
    return create_client(settings.supabase_url, settings.supabase_anon_key)

def get_supabase_service() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

async def get_current_farmer_id(
    authorization: str = Header(...),
    db: Client = Depends(get_supabase),
) -> UUID:
    token = authorization.removeprefix("Bearer ").strip()
    try:
        user = db.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return UUID(user.user.id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

### 1.6 CRUD Routers

Build these endpoints for Phase 1:

**farms.py:** `GET /farms`, `POST /farms`, `PATCH /farms/{id}`, `DELETE /farms/{id}`

**crops.py:** `GET /crops?farm_id=`, `POST /crops`, `PATCH /crops/{id}`, `PATCH /crops/{id}/status`

**expenses.py:** `GET /expenses?crop_record_id=&from=&to=`, `POST /expenses`, `DELETE /expenses/{id}`

**activity.py:** `GET /activity?limit=50`, `POST /activity`, `DELETE /activity/{id}`

All endpoints: thin router → service function → Pydantic response model. No raw Supabase row shapes in responses.

### 1.7 Weather service stub

```python
# services/weather_client.py
import httpx
from config import settings

async def get_weather(district: str, lat: float = None, lon: float = None) -> dict:
    """Fetches current weather from Open-Meteo. Returns empty dict on failure."""
    try:
        # Use geocoding API if lat/lon not provided
        # For now, use hardcoded coordinates for common districts as fallback
        if not lat or not lon:
            return {"temp": None, "humidity": None, "rainfall": None, "forecast": "unavailable"}
        
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.open_meteo_base_url}/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,precipitation",
                    "forecast_days": 1,
                }
            )
            resp.raise_for_status()
            data = resp.json()
            current = data.get("current", {})
            return {
                "temp": current.get("temperature_2m"),
                "humidity": current.get("relative_humidity_2m"),
                "rainfall": current.get("precipitation"),
                "forecast": "available",
            }
    except Exception:
        return {"temp": None, "humidity": None, "rainfall": None, "forecast": "unavailable"}
```

**Note:** Open-Meteo needs lat/lon. For Phase 1, store `latitude`/`longitude` from farm GPS. In Phase 5, add geocoding from district name for farmers without GPS.

### 1.8 Update frontend environment

Add `VITE_API_BASE_URL=http://localhost:8000` to `frontend/.env`.

Do NOT change any frontend calls yet. The frontend still talks to Supabase directly. Phase 2 handles the routing switch.

### Phase 1 Verification Checklist
- [ ] `uvicorn main:app --reload` starts without errors
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] `POST /farms` with valid JWT creates a farm
- [ ] `GET /farms` with valid JWT returns farmer's farms only (RLS validated)
- [ ] `POST /farms` with a different farmer's JWT cannot see first farmer's data
- [ ] `POST /activity` creates an activity_logs row
- [ ] `GET /expenses` filters by crop_record_id correctly
- [ ] All endpoints return named Pydantic models, no raw dicts

### Phase 1 Doc Updates
- `backend/docs/API.md`: all Phase 1 endpoints documented
- `backend/docs/backend_doc.md`: created with service map and env var table
- `.agent-local/logs/CHANGE_LOG.md`
- `.agent-local/state/ACTIVE_STATUS.md`

---

## Phase 2 — Advisory Integration (Chat → Backend)

**Goal:** Browser stops calling Dify directly. All chat traffic goes through FastAPI. Audit logging works.

### 2.1 Backend: advisory router + services

**New files:**
- `routers/advisory.py`
- `services/context_assembler.py`
- `services/dify_client.py`
- `services/audit_writer.py` (complete implementation)
- `models/advisory.py`

**POST /api/v1/advisory/ask**

Request:
```json
{
  "session_id": "uuid",
  "input_channel": "text",
  "farmer_input_text": "What should I do about yellow leaves on my paddy?",
  "farm_id": null,
  "crop_record_id": null
}
```

Response:
```json
{
  "response_text": "...",
  "was_deferred_to_kvk": false,
  "latency_ms": 1423,
  "session_id": "uuid",
  "message_id": "uuid",
  "conversation_id": "dify-conv-id"
}
```

**POST /api/v1/advisory/sessions** — creates a new advisory session, returns session_id

**context_assembler.py:** All four DB reads (farmer, farm, active crop, expenses) must fire with `asyncio.gather`, not sequentially. Weather fires in parallel too.

**dify_client.py:** POST to Dify Chat API. Parse response. Extract `was_deferred_to_kvk` from response text pattern or Dify metadata. Return `DifyResponse` model.

**audit_writer.py:** Uses service-role Supabase client. Writes complete `advisory_messages` row. `context_block_sent` must never be null.

### 2.2 Frontend: switch chat to backend

**File to change: `frontend/src/lib/difyClient.js`**

Replace or supplement with a backend client:

```javascript
// frontend/src/lib/backendClient.js

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export async function askAdvisory({ sessionId, inputChannel, farmerInputText, farmId, cropRecordId, token }) {
    const resp = await fetch(`${API_BASE}/api/v1/advisory/ask`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            session_id: sessionId,
            input_channel: inputChannel,
            farmer_input_text: farmerInputText,
            farm_id: farmId || null,
            crop_record_id: cropRecordId || null,
        }),
    })
    if (!resp.ok) throw new Error(`Advisory API error ${resp.status}`)
    return resp.json()
}

export async function createAdvisorySession({ token }) {
    const resp = await fetch(`${API_BASE}/api/v1/advisory/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    })
    if (!resp.ok) throw new Error(`Session create error ${resp.status}`)
    return resp.json()
}
```

**File to change: `frontend/src/screens/AIAssistantChatScreen.jsx`**

Key changes:
1. Remove `import { sendMessage as difySendMessage } from '../lib/difyClient'`
2. Import `{ askAdvisory, createAdvisorySession }` from `../lib/backendClient`
3. Get JWT token from `session.access_token` (already available via `useAuth`)
4. On mount: call `createAdvisorySession` to get `session_id`, store in state
5. On send: call `askAdvisory` instead of `difySendMessage`
6. Persist `session_id` in localStorage (not `conversation_id` — that's internal now)
7. Remove all client-side context assembly (`loadFarmerContext` function can be simplified — the backend now assembles context)
8. Keep the context badge display — fetch the summary data separately for UI purposes only

Do NOT remove `difyClient.js` yet — keep it until Phase 2 is verified end-to-end.

### 2.3 Session management

The frontend held `conversation_id` from Dify in localStorage. Now:
- Frontend holds `session_id` (Supabase advisory_sessions UUID)
- Backend holds `conversation_id` internally (Dify's ID, stored in advisory_messages or session)
- Add `dify_conversation_id` column to `advisory_sessions` table (migration 020)

```sql
-- supabase/migrations/020_advisory_session_dify_conv.sql
BEGIN;
ALTER TABLE advisory_sessions ADD COLUMN IF NOT EXISTS dify_conversation_id text;
COMMIT;
```

The backend reads `dify_conversation_id` from the session on each turn and passes it to Dify for conversation continuity.

### 2.4 Handle session creation flow in frontend

On entering `/assistant`:
1. Check localStorage for existing `session_id`
2. If exists: verify it's still open (call `GET /advisory/sessions/{id}`)
3. If not: call `POST /advisory/sessions` to create one
4. Store `session_id` in localStorage
5. On "New Chat" button: call `PATCH /advisory/sessions/{id}` to set `ended_at`, clear localStorage, create new session

### Phase 2 Verification Checklist
- [x] Sending a chat message goes to FastAPI, not Dify directly (verify in browser network tab)
- [x] Response appears in chat UI correctly
- [x] `advisory_messages` row exists in Supabase after each turn (check in Supabase dashboard)
- [x] `context_block_sent` is populated (not null) in every row
- [x] `advisory_sessions.total_turns` increments (trigger fires)
- [x] `was_deferred_to_kvk` is false for normal queries
- [x] Conversation continuity works across multiple turns in same session
- [x] "New Chat" creates a new session and starts fresh
- [x] Dify is no longer called directly from the browser (remove VITE_DIFY_CHATBOT_API_KEY from frontend env)

### Phase 2 Doc Updates
- `backend/docs/API.md`: `POST /advisory/ask`, `POST /advisory/sessions`, `PATCH /advisory/sessions/{id}`
- `backend/docs/backend_doc.md`: update service map with advisory pipeline
- `schema.md`: add migration 020
- `.agent-local/decisions/DECISION_LOG.md`: record decision to proxy Dify through backend
- `.agent-local/state/ACTIVE_STATUS.md`, `HANDOFF.md`

---

## Phase 3 — ML Service Stubs + Camera Integration

**Goal:** Camera screen makes real backend calls. ML services exist with stub responses so the full pipeline can be tested. Real models come in Phase 7.

### 3.1 ML microservice structure (all four)

Each ML service is an independent FastAPI app. Create this structure for each:

```
ml/soil_classifier/
├── main.py
├── requirements.txt
├── Dockerfile
└── model/       (empty until Phase 7)

ml/crop_recommender/
├── main.py
├── requirements.txt
└── Dockerfile

ml/price_forecaster/
├── main.py
├── requirements.txt
└── Dockerfile

ml/transcriber/
├── main.py
├── requirements.txt
└── Dockerfile
```

### 3.2 Stub implementations

**Soil classifier stub** (`ml/soil_classifier/main.py`):
```python
from fastapi import FastAPI, UploadFile, File, Form
from uuid import UUID
import random

app = FastAPI(title="Soil Classifier — STUB")

CLASSES = ["clay", "loam", "sandy", "red", "black", "alluvial"]

@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub"}

@app.get("/version")
def version():
    return {"version": "0.0.1-stub", "model": "YOLOv8n-stub"}

@app.post("/classify")
async def classify(
    image: UploadFile = File(...),
    farm_id: str = Form(...),
    farmer_id: str = Form(...),
):
    # STUB: returns random class. Replace with real model in Phase 7.
    await image.read()  # consume bytes, do not store
    predicted = random.choice(CLASSES)
    return {
        "predicted_soil_class": predicted,
        "confidence_score": round(random.uniform(0.75, 0.97), 3),
        "farm_id": farm_id,
        "farmer_id": farmer_id,
    }
```

Same pattern for `crop_recommender`, `price_forecaster`, `transcriber` with appropriate stub responses.

### 3.3 Backend: soil scan endpoint

**POST /api/v1/soil/scan** — accepts multipart/form-data with image + farm_id

Flow:
1. Validate farm belongs to farmer (RLS check via farmer JWT)
2. Upload image to Supabase Storage `soil-images` bucket at `{farmer_id}/{farm_id}/{timestamp}.jpg`
3. Call soil classifier microservice with image bytes
4. Write row to `soil_scans` (service role client)
5. Trigger fires: updates `farms.soil_type` automatically
6. Return result to frontend

**POST /api/v1/pest/scan** — same pattern for pest images

### 3.4 Frontend: CropDiseaseDetectionCamera

Replace the mocked `handleCapture` with a real camera flow:

```javascript
// Current: simulated timeout with fake result
// Replace with:

const handleCapture = async () => {
    if (!imageFile) return
    setIsScanning(true)
    try {
        const formData = new FormData()
        formData.append('image', imageFile)
        formData.append('farm_id', selectedFarmId)
        
        const resp = await fetch(`${API_BASE}/api/v1/pest/scan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            body: formData,
        })
        const data = await resp.json()
        setResult({
            disease: data.predicted_pest_or_disease,
            confidence: `${Math.round(data.confidence_score * 100)}%`,
            severity: data.severity || 'Unknown',
            treatment: data.treatment_hint || 'Consult Sakhi for treatment advice',
        })
    } catch (err) {
        setResult({ disease: 'Detection failed', confidence: '—', severity: '—', treatment: 'Please try again.' })
    } finally {
        setIsScanning(false)
    }
}
```

Also add:
- Real camera access via `<input type="file" accept="image/*" capture="environment" />`
- Farm selector before scanning (user must select which farm/crop)
- Client-side image compression before upload (canvas resize to max 1200px)

### 3.5 docker-compose.yml

Create root `docker-compose.yml` for local dev:

```yaml
version: '3.9'
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    depends_on: []

  soil_classifier:
    build: ./ml/soil_classifier
    ports: ["8001:8001"]

  crop_recommender:
    build: ./ml/crop_recommender
    ports: ["8002:8002"]

  price_forecaster:
    build: ./ml/price_forecaster
    ports: ["8003:8003"]

  transcriber:
    build: ./ml/transcriber
    ports: ["8004:8004"]
```

Frontend runs separately with `npm run dev` (not containerized for dev).

### Phase 3 Verification Checklist
- [ ] `docker-compose up` starts all services without errors
- [ ] `GET /health` returns ok on all ML service ports
- [x] Camera screen opens and requests camera permission
- [x] Image capture triggers a real POST to backend
- [x] Scan result displays (stub data is fine)
- [x] `soil_scans` or `pest_scans` row written to DB after scan
- [x] `farms.soil_type` updated after soil scan (trigger verification)
- [x] Image stored in Supabase Storage bucket
- [x] Scanned image is NOT stored locally or logged

### Phase 3 Doc Updates
- `backend/docs/API.md`: add soil/scan and pest/scan endpoints
- Each ML service: `README.md` with startup instructions
- `.agent-local/state/ACTIVE_STATUS.md`, `HANDOFF.md`

---

## Phase 4 — Finance Tracker + Expense Logs

**Goal:** `FarmFinanceTracker` reads/writes real `expense_logs` data. Replaces all hardcoded mock data.

### 4.1 Backend expense endpoints (already stubbed in Phase 1)

Verify and complete:
- `GET /api/v1/expenses?crop_record_id=&from=&to=` — paginated, date-filtered
- `POST /api/v1/expenses` — creates expense_log row
- `DELETE /api/v1/expenses/{id}` — farmer can delete own entries
- `GET /api/v1/expenses/summary?crop_record_id=` — returns totals grouped by category (used for dashboard pie chart)

### 4.2 Frontend: FarmFinanceTracker

Replace all hardcoded data with real DB calls:

```javascript
const fetchFinanceData = async () => {
    const { data: expenses } = await supabase
        .from('expense_logs')
        .select('*')
        .eq('farmer_id', user.id)
        .order('expense_date', { ascending: false })
    
    const { data: yields } = await supabase
        .from('yield_records')
        .select('*')
        .eq('farmer_id', user.id)
        .order('sale_date', { ascending: false })
    
    // Compute summary
    const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount_inr), 0) || 0
    const totalIncome = yields?.reduce((sum, y) => sum + (Number(y.yield_kg) * Number(y.sale_price_per_kg)), 0) || 0
    ...
}
```

Add real "Add Expense" modal (reuse `AddActivityModal` pattern).

Add real "Log Sale/Yield" modal that writes to `yield_records`.

### Phase 4 Verification Checklist
- [x] Finance screen shows real expense data from DB
- [x] "Add Expense" modal writes to `expense_logs`
- [x] Expense summary totals match DB data
- [x] `yield_records` entries appear as income
- [x] Delete expense removes from DB and updates UI
- [x] Empty state shows correctly when no expenses exist

---

## Phase 5 — Weather Integration (Live Data)

**Goal:** Dashboard weather card shows real data. Context assembler sends real weather to Dify.

### 5.1 District → coordinates mapping

Add a utility that maps district names to lat/lon. Two approaches:
- **Static map:** Add `latitude`, `longitude` columns to `ref_locations` and seed them. Best approach.
- **Geocoding API:** Call Nominatim on first request and cache. Fragile for Indian district names.

Use the static map. Migration:

```sql
-- supabase/migrations/021_ref_locations_coords.sql
BEGIN;
ALTER TABLE ref_locations ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE ref_locations ADD COLUMN IF NOT EXISTS longitude numeric;
-- Seed with approximate district centroids for TN and AP districts
-- (coordinate data from public government geospatial sources)
COMMIT;
```

Add seed data for all 64 districts (Tamil Nadu 38 + Andhra Pradesh 26).

### 5.2 Backend weather_client.py (complete)

```python
async def get_weather_for_district(district: str, db: Client) -> dict:
    # Look up lat/lon from ref_locations
    result = db.table("ref_locations").select("latitude, longitude") \
        .eq("district", district).limit(1).execute()
    
    if not result.data or not result.data[0].get("latitude"):
        return {"temp": None, "humidity": None, "rainfall": None, "forecast": "unavailable"}
    
    lat = result.data[0]["latitude"]
    lon = result.data[0]["longitude"]
    return await get_weather(district, lat, lon)
```

### 5.3 Frontend: HomeDashboard weather card

```javascript
const fetchWeather = async () => {
    if (!farmer?.district) return
    const resp = await fetch(`${API_BASE}/api/v1/weather?district=${farmer.district}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await resp.json()
    setWeather(data)
}
```

Replace hardcoded `32°`, `75%`, `2mm` with `weather.temp`, `weather.humidity`, `weather.rainfall`.

### Phase 5 Verification Checklist
- [x] Dashboard shows real temperature for farmer's district
- [x] Context assembler includes real weather in `context_block_sent`
- [x] Weather failure (network down) does not break advisory flow
- [x] Weather card shows "unavailable" gracefully when API is down

---

## Phase 6 — Voice Input

**Goal:** Mic button in chat screen records voice, sends to transcriber, submits transcription as text. Audio never stored.

### 6.1 Frontend: useVoiceRecorder.js hook

```javascript
// src/hooks/useVoiceRecorder.js

import { useState, useRef } from 'react'

export function useVoiceRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [audioBlob, setAudioBlob] = useState(null)
    const mediaRecorderRef = useRef(null)
    const chunksRef = useRef([])

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        mediaRecorderRef.current = mediaRecorder
        chunksRef.current = []

        mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data)
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
            setAudioBlob(blob)
            chunksRef.current = []
            stream.getTracks().forEach(t => t.stop())
        }

        mediaRecorder.start()
        setIsRecording(true)
    }

    const stopRecording = () => {
        mediaRecorderRef.current?.stop()
        setIsRecording(false)
    }

    const clearAudio = () => setAudioBlob(null)

    return { isRecording, audioBlob, startRecording, stopRecording, clearAudio }
}
```

### 6.2 Backend: transcription endpoint

**POST /api/v1/advisory/transcribe** — multipart/form-data with `audio` field

```python
@router.post("/advisory/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    farmer_id: UUID = Depends(get_current_farmer_id),
):
    audio_bytes = await audio.read()
    # CRITICAL: audio_bytes is never stored. Pass to transcriber microservice.
    text = await ml_dispatcher.call_transcriber(audio_bytes)
    # audio_bytes goes out of scope here and is GC'd
    return TranscriptionResponse(text=text, input_channel="voice")
```

### 6.3 Frontend: AIAssistantChatScreen voice flow

```javascript
const handleVoiceSend = async (audioBlob) => {
    setIsTyping(true)
    try {
        // Step 1: Transcribe
        const formData = new FormData()
        formData.append('audio', audioBlob, 'voice.webm')
        const transcResp = await fetch(`${API_BASE}/api/v1/advisory/transcribe`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            body: formData,
        })
        const { text } = await transcResp.json()
        
        // Step 2: Show transcribed text as user message, send as voice input
        addUserMessage(text)
        await sendToAdvisory(text, 'voice')
    } finally {
        setIsTyping(false)
        clearAudio()
        // audioBlob no longer referenced — GC'd
    }
}
```

### Phase 6 Verification Checklist
- [x] Mic button press starts recording (browser permission requested)
- [x] Stop button ends recording
- [x] Transcription returns text from ElevenLabs STT
- [x] Transcribed text appears as user message in chat
- [x] Advisory response comes back correctly
- [x] No audio file exists anywhere in storage after the flow completes
- [ ] `advisory_messages.input_channel` = 'voice' (Requires Audit writer implementation)
- [x] Text-to-Speech (TTS) automatically generated and autoplayed on both manual chat and voice chat

*(Status: Voice feature is functional end-to-end on both frontend and backend. Fallback errors handled via TTS. Audit writer remains as a future persistence step).*

---

## Phase 7 — ML Services Full Implementation

**Goal:** Replace all stubs with real trained models. This is the longest phase.

### 7.1 Soil Classifier (YOLOv8n)

**Setup:**
```
ml/soil_classifier/
├── main.py
├── model/
│   └── soil_yolov8n.pt       (trained weights — obtain from research paper)
├── requirements.txt           (ultralytics, fastapi, python-multipart)
└── Dockerfile
```

**Implementation:**
```python
from ultralytics import YOLO
import io
from PIL import Image

model = YOLO("model/soil_yolov8n.pt")
CLASSES = ["clay", "loam", "sandy", "red", "black", "alluvial"]

@app.post("/classify")
async def classify(image: UploadFile = File(...), farm_id: str = Form(...), farmer_id: str = Form(...)):
    img_bytes = await image.read()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    results = model(img)
    top_class = results[0].probs.top1
    confidence = float(results[0].probs.top1conf)
    return {
        "predicted_soil_class": CLASSES[top_class],
        "confidence_score": round(confidence, 4),
        "farm_id": farm_id,
        "farmer_id": farmer_id,
    }
```

### 7.2 Crop Recommender (Random Forest)

```
ml/crop_recommender/
├── main.py
├── model/
│   └── crop_rf.pkl            (scikit-learn RandomForestClassifier, pickled)
├── requirements.txt           (scikit-learn, fastapi, joblib)
└── Dockerfile
```

**Request body:** N, P, K, pH, temperature, humidity, rainfall (7 floats)
**Response:** top_recommendation, recommendation_scores array

### 7.3 Price Forecaster (Prophet)

```
ml/price_forecaster/
├── main.py
├── models/
│   └── {crop}_{district}.pkl  (pre-trained Prophet models per commodity/district)
├── data/
│   └── fetch_mandi.py         (pulls from data.gov.in API, refreshes weekly)
├── requirements.txt           (prophet, fastapi, pandas)
└── Dockerfile
```

**Endpoint:** `POST /forecast` — body: crop_name, district, horizon_days (7 or 14)
**Response:** directional_signal (UP/DOWN/STABLE), forecast_mape

**Critical:** Never surface raw price predictions. Only directional signal. Enforce in response model.

### 7.4 Whisper Transcriber

```
ml/transcriber/
├── main.py
├── requirements.txt           (openai-whisper, fastapi, python-multipart, ffmpeg-python)
└── Dockerfile
```

```python
import whisper
import io
import soundfile as sf
import numpy as np

model = whisper.load_model("base")  # 74M params

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    # Convert webm to wav in memory — never write to disk
    audio_array, sample_rate = sf.read(io.BytesIO(audio_bytes))
    if audio_array.ndim > 1:
        audio_array = audio_array.mean(axis=1)
    audio_float = audio_array.astype(np.float32)
    
    result = model.transcribe(audio_float, language="en")
    # audio_bytes, audio_array, audio_float go out of scope here
    return {
        "text": result["text"].strip(),
        "confidence": result.get("avg_logprob", 0.0),
    }
```

**Dockerfile requirement:** Include `ffmpeg` for audio format conversion.

### 7.5 Wire ML outputs into advisory context

After Phase 7, update the advisory flow:

When the user sends an image with a message:
1. Frontend sends image to backend with the advisory request
2. Backend runs appropriate ML service
3. ML result appended to `ContextBlock.ml_outputs`
4. Dify receives full context including ML classification

```json
"ml_outputs": {
  "soil_scan": {
    "predicted_class": "black",
    "confidence": 0.94,
    "farm_id": "..."
  }
}
```

### Phase 7 Verification Checklist
- [ ] Soil classifier returns non-stub result on real soil image
- [ ] Crop recommender returns sensible top recommendation given real NPK/weather inputs
- [ ] Price forecaster returns UP/DOWN/STABLE for paddy in Madurai
- [ ] Whisper transcribes a Tamil-accented English farming question correctly
- [ ] All ML `/health` and `/version` endpoints respond
- [ ] No audio or image bytes written to disk in any ML service

---

## Phase 8 — PWA Hardening + Offline

**Goal:** App installs on Android, works offline for reads, queues writes for when connectivity restores.

### 8.1 Service Worker (Vite PWA plugin)

`frontend/vite.config.js` — enable PWA plugin (already in dependencies):

```javascript
import { VitePWA } from 'vite-plugin-pwa'

export default {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Krishi Sakhi',
        short_name: 'Sakhi',
        description: 'AI agricultural advisor for smallholder farmers',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/(ref_crops|ref_locations)/,
            handler: 'CacheFirst',
            options: { cacheName: 'supabase-ref-data', expiration: { maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
}
```

### 8.2 Offline banner

Create `src/components/OfflineBanner.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine)
    
    useEffect(() => {
        const on = () => setIsOffline(false)
        const off = () => setIsOffline(true)
        window.addEventListener('online', on)
        window.addEventListener('offline', off)
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
    }, [])
    
    if (!isOffline) return null
    
    return (
        <div className="fixed top-0 w-full max-w-md z-50 bg-amber-500 text-white text-sm font-semibold px-4 py-2 flex items-center gap-2">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            No internet — some features may be unavailable
        </div>
    )
}
```

Add to `App.jsx` above `<Routes>`.

### 8.3 App icons

Create proper `icon-192.png` and `icon-512.png` (leaf/plant motif). Replace `vite.svg`.

### 8.4 Install prompt

```jsx
// src/hooks/usePWAInstall.js
import { useState, useEffect } from 'react'

export function usePWAInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState(null)
    
    useEffect(() => {
        const handler = (e) => { e.preventDefault(); setDeferredPrompt(e) }
        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])
    
    const install = async () => {
        if (!deferredPrompt) return
        deferredPrompt.prompt()
        await deferredPrompt.userChoice
        setDeferredPrompt(null)
    }
    
    return { canInstall: !!deferredPrompt, install }
}
```

Show install banner on Dashboard if `canInstall` and not yet installed.

### Phase 8 Verification Checklist
- [ ] Lighthouse PWA score ≥ 90
- [ ] App installs from Chrome on Android
- [ ] Installed app opens without browser chrome
- [ ] Offline banner appears when network disconnected
- [ ] `ref_crops` and `ref_locations` load from cache when offline
- [ ] Advisory chat shows "offline" error gracefully when backend unreachable

---

## Phase 9 — Testing + Observability

**Goal:** A minimal test suite that catches regressions. Basic logging so issues are diagnosable.

### 9.1 Backend tests

```
backend/tests/
├── conftest.py
├── test_advisory.py
├── test_farms.py
├── test_context_assembler.py
└── test_audit_writer.py
```

**Minimum required tests:**

`test_context_assembler.py`:
- All four DB reads fire concurrently (mock asyncio.gather, verify single call)
- Returns valid ContextBlock when all reads succeed
- Returns ContextBlock with empty fields when reads fail (non-fatal)

`test_advisory.py`:
- POST /advisory/ask with valid JWT returns AdvisoryResponse
- POST /advisory/ask with invalid JWT returns 401
- POST /advisory/ask when Dify is down returns 503 (mock Dify client)
- advisory_messages row is written after successful turn (mock audit_writer, verify call)

`test_farms.py`:
- GET /farms returns only current farmer's farms (not another farmer's)
- DELETE /farms/{id} with a farm that has active crop_records returns 409

### 9.2 Structured logging

```python
# In main.py
import logging
import json

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
)

# In advisory router
logger = logging.getLogger("advisory")
logger.info(json.dumps({
    "event": "advisory_turn_complete",
    "farmer_id": str(farmer_id),
    "latency_ms": latency_ms,
    "was_deferred": was_deferred_to_kvk,
    "channel": input_channel,
}))
```

### 9.3 Dify retrieval validation

Periodically run the 15 Ragas evaluation queries (from the research paper) and log faithfulness/relevancy scores. Not automated in Phase 9 — document the manual process.

### Phase 9 Verification Checklist
- [ ] `pytest backend/tests/` passes with no failures
- [ ] At least one test verifies RLS (farmer A cannot see farmer B's data)
- [ ] Advisory audit write test passes
- [ ] Context assembler concurrency test passes
- [ ] Logs show structured JSON on each advisory turn

---

## Phase 10 — Pre-Deployment Checklist

Run this before any public access:

### Security
- [ ] No secrets in any tracked file (`git log --all -S "eyJ"` finds nothing)
- [ ] Service role key is NOT accessible from browser (`VITE_` prefixed vars only)
- [ ] Supabase RLS verified: authenticated user cannot access other farmers' rows
- [ ] Storage bucket RLS verified: cannot download another farmer's image
- [ ] CORS origins locked to production domain (not `*`)
- [ ] Rate limiting on `/advisory/ask` (30 req/min per farmer)

### Performance
- [ ] Context assembly P50 ≤ 2000ms measured on production Supabase (not local)
- [ ] All ML service Docker images under 2GB
- [ ] Supabase connection pooling configured (use pgBouncer if on Pro plan)

### Data integrity
- [ ] Every `advisory_messages` row has non-null `context_block_sent`
- [ ] `advisory_sessions.total_turns` matches actual message count (trigger validated)
- [ ] `farms.soil_type` updates after soil scan (trigger validated)

### Operational
- [ ] `docker-compose up` starts all services cleanly from cold
- [ ] Health checks pass for all ML services
- [ ] Frontend build (`npm run build`) passes with no errors
- [ ] PWA manifest valid (no missing icons)
- [ ] `backend/.env.example` documents all required variables
- [ ] `README.md` has accurate local setup instructions

---

## Schema Tracking — What Exists vs What Should Exist

### Tables that exist in authoritative schema but frontend never uses
- `yield_records` — add to FarmFinanceTracker (Phase 4)
- `soil_scans` — wired in Phase 3
- `pest_scans` — wired in Phase 3
- `crop_recommendation_requests` — wired in Phase 7
- `price_forecast_requests` — wired in Phase 7
- `ref_knowledge_documents` — display-only, used in Dify admin not farmer UI

### Tables frontend uses that need migration (Phase 0)
- `farm_crops` → reconcile to `crop_records`
- `activity_logs` → add to schema (genuinely needed)

### Columns with drift
- `farmers.phone_number` — not in schema, insert silently fails — log as known tech debt, address in field trial prep

---

## Agent Handoff Rules

When switching agents between phases:

**Before ending a session, update these files:**

1. `.agent-local/logs/CHANGE_LOG.md` — what changed, why
2. `.agent-local/state/ACTIVE_STATUS.md` — current phase, what is done, what blocks
3. `.agent-local/state/HANDOFF.md` — next task, guardrails, known risks

**When starting a new session:**

1. Read `docs/ARCHITECTURE.md`
2. Read `.agent-local/state/ACTIVE_STATUS.md`
3. Read `.agent-local/state/HANDOFF.md`
4. Run `git status --short` — treat uncommitted files as active context
5. Read the Phase 0 findings section above — schema drift is the most likely cause of unexpected errors

**Never:**
- Move or delete `supabase-gen-code/` without explicit decision logged
- Bypass RLS with service role in application code
- Store audio bytes anywhere
- Add business logic to routers

---

## Quick Reference — What Goes Where

| Need | Location |
|---|---|
| New DB table | Update `schema.md` first, then write migration in `supabase/migrations/` |
| New backend endpoint | `routers/` (thin), `services/` (logic), `models/` (types), `docs/API.md` |
| New frontend screen | `src/screens/`, add route to `App.jsx`, add to screen inventory in `.agent/frontend-engineer.md` |
| New ML capability | New service in `ml/`, add to `docker-compose.yml`, add env var to `config.py` |
| Architecture decision | `.agent-local/decisions/DECISION_LOG.md` |
| Any change whatsoever | `.agent-local/logs/CHANGE_LOG.md` |

---

*Plan version: 1.0 — based on full code audit of krishi-sakhi-main.zip (2026-04-04)*
*Update this document when a phase is completed or a phase's scope changes.*
