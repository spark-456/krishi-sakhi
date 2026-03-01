# Backend Engineer Skill — Krishi Sakhi

> Read this document fully before writing a single line of code, creating a file, or touching a migration. This skill encodes the engineering standards, patterns, and constraints for the Krishi Sakhi FastAPI backend. Deviate only with explicit justification logged in a `# DEVIATION:` comment.

---

## 0. Pre-Flight Checklist

Before any task, answer these questions internally:

1. **Does this touch the context assembly hot path?** (Section 4, Step 2 of context.md) → If yes, the change must not add a new sequential DB read or external call.
2. **Does this write to the database?** → If yes, is `farmer_id` validated against `auth.uid()` before the write?
3. **Does this create a new table?** → It needs `farmer_id FK → farmers.id`, `created_at`, and full RLS policies before touching production.
4. **Does this involve audio?** → Audio must never be persisted. Memory-only. Transcribe-and-discard.
5. **Does this add a new endpoint?** → It needs a route, a Pydantic request/response model, an entry in `API.md`, and must preserve the P50 ≤ 2s latency constraint.

---

## 1. Architectural Principles

These are non-negotiable. Every line of backend code must be consistent with them.

**Single Responsibility per File.** Routers handle HTTP. Services handle business logic. Models handle serialisation. No exceptions.

**Fail Loud, Fail Fast.** Raise typed HTTPException immediately on invalid input, missing auth, or constraint violations. Never swallow errors into generic 500s.

**No Leaking Internals.** Database row shapes, Supabase client internals, and ML service response structures must never appear in HTTP responses. Always map through a Pydantic response model.

**Single-Pass Context Assembly.** The context assembler (Section 4 in context.md) must complete all its DB reads in one logical batch. No paginated loops, no lazy loading, no mid-assembly blocking ML calls.

**Audit Everything.** Every advisory turn must write a complete `advisory_messages` row including `context_block_sent`, `retrieved_chunk_ids`, `response_latency_ms`, and `was_deferred_to_kvk`. This is not optional.

**Service Role is Admin-Only.** The Supabase service role key is for migrations and ML output writes only. Application code serving farmer requests always uses the farmer's JWT.

---

## 2. Directory Layout

```
backend/
├── main.py                   # App factory, middleware, router registration
├── config.py                 # Settings via pydantic-settings (env vars only)
├── dependencies.py           # Shared FastAPI dependencies (get_current_farmer, supabase_client)
│
├── routers/
│   ├── __init__.py
│   ├── auth.py               # POST /auth/verify-otp, POST /auth/refresh
│   ├── advisory.py           # POST /advisory/ask
│   ├── farms.py              # CRUD /farms
│   ├── crops.py              # CRUD /crops, PATCH /crops/{id}/status
│   ├── expenses.py           # CRUD /expenses
│   ├── soil.py               # POST /soil/scan
│   └── prices.py             # POST /prices/forecast
│
├── services/
│   ├── __init__.py
│   ├── context_assembler.py  # Assembles farmer context block for Dify
│   ├── ml_dispatcher.py      # Calls ML microservices, handles timeouts/fallback
│   ├── dify_client.py        # POSTs to Dify Chat API, parses response
│   ├── weather_client.py     # Calls Open-Meteo, returns structured weather dict
│   └── audit_writer.py       # Writes advisory_messages after each turn
│
├── models/
│   ├── __init__.py
│   ├── farmer.py             # FarmerProfile, FarmerUpdate
│   ├── farm.py               # FarmCreate, FarmRead, FarmUpdate
│   ├── crop.py               # CropRecordCreate, CropRecordRead, StatusUpdate
│   ├── expense.py            # ExpenseLogCreate, ExpenseLogRead
│   ├── advisory.py           # AdvisoryRequest, AdvisoryResponse, ContextBlock
│   ├── ml.py                 # SoilScanResult, CropRecommendation, PriceForecast
│   └── common.py             # PaginatedResponse, ErrorDetail
│
└── docs/
    ├── backend_doc.md        # Living architecture + service contract documentation
    └── API.md                # All endpoint specs (auto-updated on every route change)
```

**Rule:** When you create a new file, it goes in the right directory for its responsibility. A router file must never contain business logic. A service must never import from routers.

---

## 3. Coding Standards

### 3.1 FastAPI Patterns

```python
# ✅ Correct — router thin, delegates to service
@router.post("/ask", response_model=AdvisoryResponse, status_code=200)
async def ask_advisory(
    body: AdvisoryRequest,
    farmer: FarmerProfile = Depends(get_current_farmer),
    db: AsyncClient = Depends(get_supabase),
) -> AdvisoryResponse:
    return await advisory_service.handle_ask(farmer=farmer, body=body, db=db)

# ❌ Wrong — business logic bleeding into router
@router.post("/ask")
async def ask_advisory(body: AdvisoryRequest, ...):
    farmer = await db.table("farmers").select("*").eq("id", farmer_id).execute()
    context = {"farmer": farmer.data[0], ...}  # <- this is service logic
    ...
```

### 3.2 Pydantic Models

```python
# models/advisory.py
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class AdvisoryRequest(BaseModel):
    session_id: UUID
    input_channel: Literal["text", "voice", "image"]
    farmer_input_text: str = Field(..., min_length=1, max_length=2000)
    farm_id: Optional[UUID] = None          # Required if image upload
    crop_record_id: Optional[UUID] = None   # Required if pest scan

class AdvisoryResponse(BaseModel):
    response_text: str
    was_deferred_to_kvk: bool
    latency_ms: int
    session_id: UUID
    message_id: UUID

class ContextBlock(BaseModel):
    """Exact shape sent to Dify. Never expose this to the client."""
    farmer: dict
    farm: dict
    active_crop: Optional[dict]
    recent_expenses: dict
    weather: dict
    ml_outputs: Optional[dict] = None
```

**Rule:** Every endpoint must have a named request model and a named response model. No `dict`, no `Any`, no raw Supabase row shapes in response models.

### 3.3 Dependency Injection

```python
# dependencies.py

async def get_current_farmer(
    authorization: str = Header(...),
    db: AsyncClient = Depends(get_supabase),
) -> FarmerProfile:
    """Validates JWT, returns hydrated FarmerProfile. Raises 401 if invalid."""
    token = authorization.removeprefix("Bearer ").strip()
    user = await db.auth.get_user(token)
    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    farmer = await db.table("farmers").select("*").eq("id", user.user.id).single().execute()
    if not farmer.data:
        raise HTTPException(status_code=404, detail="Farmer profile not found")
    return FarmerProfile(**farmer.data)
```

### 3.4 Error Handling

```python
# Use typed status codes — never generic 500 without a log
raise HTTPException(status_code=422, detail="farm_id is required for soil scan uploads")
raise HTTPException(status_code=403, detail="Farmer does not own this resource")
raise HTTPException(status_code=409, detail="Active crop already exists for this farm")
raise HTTPException(status_code=503, detail="ML service unavailable — retry after 30s")
```

### 3.5 Configuration

```python
# config.py — all secrets from environment, never hardcoded
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    dify_api_url: str
    dify_api_key: str
    soil_classifier_url: str
    crop_recommender_url: str
    price_forecaster_url: str
    transcriber_url: str
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    advisory_timeout_seconds: int = 8
    ml_timeout_seconds: int = 5

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 4. Context Assembly — The Critical Path

This is the most performance-sensitive code in the system. The P50 target is ≤ 2 seconds end-to-end. The context assembler owns Steps 1–3 of the request data flow.

```python
# services/context_assembler.py

async def assemble(
    farmer: FarmerProfile,
    db: AsyncClient,
    ml_outputs: Optional[dict] = None,
) -> ContextBlock:
    """
    Single-pass reads — all DB queries fired concurrently via asyncio.gather.
    No sequential awaits on independent queries.
    """
    farm_task = db.table("farms") \
        .select("farm_name, area_acres, soil_type, irrigation_type") \
        .eq("farmer_id", farmer.id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    crop_task = db.table("crop_records") \
        .select("crop_name, season, growth_stage, sowing_date, expected_harvest_date") \
        .eq("farmer_id", farmer.id) \
        .eq("status", "active") \
        .limit(1) \
        .execute()

    expense_task = db.table("expense_logs") \
        .select("category, amount_inr") \
        .eq("farmer_id", farmer.id) \
        .gte("expense_date", thirty_days_ago()) \
        .execute()

    weather_task = weather_client.get_weather(district=farmer.district)

    farm_res, crop_res, expense_res, weather_res = await asyncio.gather(
        farm_task, crop_task, expense_task, weather_task
    )

    expenses_by_category = aggregate_expenses(expense_res.data)

    return ContextBlock(
        farmer={"name": farmer.full_name, "district": farmer.district, "language": farmer.preferred_language},
        farm=farm_res.data[0] if farm_res.data else {},
        active_crop=crop_res.data[0] if crop_res.data else None,
        recent_expenses=expenses_by_category,
        weather=weather_res,
        ml_outputs=ml_outputs,
    )
```

**Rules for context_assembler.py:**
- All independent DB reads must be `asyncio.gather`-ed, never sequential `await`.
- Never add a new synchronous external call inside this function.
- If an ML output needs to be in context, it must already be computed before `assemble()` is called.
- The returned `ContextBlock` is the exact JSON sent to Dify — keep it flat and predictable.

---

## 5. ML Dispatcher

```python
# services/ml_dispatcher.py

async def call_soil_classifier(image_bytes: bytes, farm_id: UUID, farmer_id: UUID) -> SoilScanResult:
    """Calls YOLOv8n microservice. Times out at settings.ml_timeout_seconds."""
    async with httpx.AsyncClient(timeout=settings.ml_timeout_seconds) as client:
        resp = await client.post(
            f"{settings.soil_classifier_url}/classify",
            files={"image": image_bytes},
            data={"farm_id": str(farm_id), "farmer_id": str(farmer_id)},
        )
        resp.raise_for_status()
        return SoilScanResult(**resp.json())

async def call_transcriber(audio_bytes: bytes) -> str:
    """
    CRITICAL: audio_bytes must never be stored before or after this call.
    Returns transcribed text only. Audio is discarded in the microservice.
    """
    async with httpx.AsyncClient(timeout=settings.ml_timeout_seconds) as client:
        resp = await client.post(
            f"{settings.transcriber_url}/transcribe",
            files={"audio": audio_bytes},
        )
        resp.raise_for_status()
        return resp.json()["text"]
```

**Rules:**
- All ML calls use `httpx.AsyncClient` with an explicit timeout.
- If an ML service times out, log and continue — the advisory request should not fail because of a non-critical ML service. Set `ml_outputs` to `None` in the context block.
- `call_transcriber` must be the only place that touches audio bytes. It must never return or log raw audio.

---

## 6. Database Migrations

All migrations live in `supabase/migrations/`. They are numbered sequentially (e.g., `020_next_feature.sql`) and must be applied in order.

### Migration Template

```sql
-- supabase/migrations/020_<feature_name>.sql
-- Purpose: <one-line description>
-- Depends on: <list prior migrations this relies on>
-- Reversible: <yes/no — if yes, include a rollback block>
-- Author: <agent or developer name>
-- Date: <YYYY-MM-DD>

BEGIN;

-- === SCHEMA CHANGES ===
ALTER TABLE <table> ADD COLUMN <column> <type> <constraints>;

-- === INDEXES ===
CREATE INDEX IF NOT EXISTS idx_<table>_<column> ON <table> (<column>);

-- === RLS POLICIES ===
-- Drop and recreate if modifying existing
DROP POLICY IF EXISTS "<policy_name>" ON <table>;
CREATE POLICY "<policy_name>" ON <table>
  FOR <operation>
  USING (auth.uid() = farmer_id);

-- === TRIGGERS (if any) ===

COMMIT;
```

**Rules:**
- Every migration is wrapped in `BEGIN; ... COMMIT;`.
- Never modify an existing migration file — always create a new one.
- RLS policies are never assumed — always explicitly stated in the migration.
- The migration order from schema.md Section 11 is canonical. New migrations append to it.
- Update `schema.md` before writing the migration, not after.

---

## 7. Audit Writer

Every advisory turn must produce a complete `advisory_messages` row.

```python
# services/audit_writer.py

async def write_advisory_message(
    session_id: UUID,
    farmer_id: UUID,
    input_channel: str,
    farmer_input_text: str,
    context_block: ContextBlock,
    dify_response: DifyResponse,
    start_time: float,
    db: AsyncClient,  # Must be service-role client — advisory_messages INSERT is service role only
) -> UUID:
    latency_ms = int((time.monotonic() - start_time) * 1000)
    row = {
        "session_id": str(session_id),
        "farmer_id": str(farmer_id),
        "input_channel": input_channel,
        "farmer_input_text": farmer_input_text,
        "context_block_sent": context_block.model_dump(),
        "retrieved_chunk_ids": dify_response.retrieved_chunk_ids,
        "response_text": dify_response.response_text,
        "response_latency_ms": latency_ms,
        "was_deferred_to_kvk": dify_response.was_deferred_to_kvk,
        "dify_conversation_id": dify_response.conversation_id,
    }
    result = await db.table("advisory_messages").insert(row).execute()
    return UUID(result.data[0]["id"])
```

**Rules:**
- `audit_writer` always uses the service-role Supabase client, never the farmer's JWT client.
- `context_block_sent` must be populated. An empty or null value is a data integrity failure.
- `retrieved_chunk_ids` must be parsed from the Dify response. If Dify doesn't return them, log a warning and store an empty list — do not drop the record.
- Latency is measured from before context assembly begins to after the Dify response is received.

---

## 8. Documentation Protocol

Every time a new endpoint is created or an existing one is changed, the agent must update two documents.

### 8.1 backend_doc.md — Architecture Living Document

Location: `backend/docs/backend_doc.md`

Update this document when:
- A new service is created
- A new router/endpoint is added
- A service dependency changes
- A new environment variable is added
- A constraint or limitation is discovered

Structure:

```markdown
# Backend Architecture — Krishi Sakhi
> Last updated: <YYYY-MM-DD> | Version: <semver>

## Service Map
[Table: service name | responsibility | depends on | timeout | notes]

## Environment Variables
[Table: var name | required | default | description]

## Request Lifecycle
[Step-by-step description of a full advisory request]

## Known Constraints
[Bulleted list of hard limits and why they exist]

## Changelog
[Date | Change | Author]
```

### 8.2 API.md — Endpoint Reference

Location: `backend/docs/API.md`

Update this document every time a route is added, modified, or deprecated. This is the contract that frontend, ML services, and future agents rely on.

**Required format for each endpoint:**

```markdown
## POST /advisory/ask

**Purpose:** Submit a farmer query and receive a grounded advisory response.
**Auth:** Bearer JWT (farmer)
**Rate limit:** 30 req/min per farmer

### Request Body
| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| session_id | uuid | ✅ | Must be an open session | |
| input_channel | string | ✅ | enum: text, voice, image | |
| farmer_input_text | string | ✅ | 1–2000 chars | Pre-transcribed if voice |
| farm_id | uuid | conditional | Required if input_channel=image | |
| crop_record_id | uuid | conditional | Required for pest scans | |

### Response 200
| Field | Type | Notes |
|---|---|---|
| response_text | string | Advisory response from Dify |
| was_deferred_to_kvk | bool | True if safety guardrail triggered |
| latency_ms | int | End-to-end processing time |
| session_id | uuid | |
| message_id | uuid | ID of written advisory_messages row |

### Error Responses
| Code | Condition |
|---|---|
| 401 | Invalid or expired JWT |
| 404 | Session or farmer not found |
| 422 | Invalid request body |
| 503 | Dify service unavailable |

### Notes
- Audio must be pre-transcribed by the PWA before calling this endpoint.
  The transcription endpoint is separate (POST /advisory/transcribe).
- Response latency P50 target: ≤ 2000ms.
- Every successful call writes one advisory_messages row regardless of deferral.
```

**Rule:** `API.md` must be updated in the same commit/task as the route change. An endpoint that exists in code but not in `API.md` is considered undocumented and invalid.

---

## 9. RLS Mental Model

When writing any database query, run this check:

```
Is this using the farmer's JWT client?
  → YES: RLS will automatically filter to auth.uid() = farmer_id. You still must not pass untrusted user input as farmer_id.
  → NO (service role): RLS is bypassed. You must manually verify that the resource belongs to the intended farmer before acting on it.
```

Service role is used only for:
- `advisory_messages` INSERT
- `soil_scans` INSERT/UPDATE
- `pest_scans` INSERT
- `crop_recommendation_requests` INSERT
- `price_forecast_requests` INSERT

All other operations use the farmer's JWT.

---

## 10. Safety Guardrail Enforcement

The Dify agent enforces safety at the LLM level. The FastAPI backend enforces it at the data level.

After every Dify response:
1. Check `dify_response.was_deferred_to_kvk`.
2. If `True`, set `advisory_messages.was_deferred_to_kvk = true` in the audit record.
3. Never suppress or override a KVK deferral in the API layer.
4. Never retry a deferred query with different prompting — the deferral decision is final for that turn.

The backend must not implement its own advisory guardrails. Guardrails belong in the Dify prompt. If a guardrail needs to be updated, it is updated in Dify — not in FastAPI code.

---

## 11. Adding a New Feature — Step-by-Step

Follow this sequence exactly. Do not skip steps.

```
1. Read context.md, schema.md fully if you haven't already this session.

2. Determine if a new DB table is needed.
   → If yes: update schema.md FIRST, then write the migration.

3. Write the Pydantic models in models/.

4. Write the service function in services/.
   → Pure business logic. No HTTP. No Supabase imports in request handlers.

5. Write the router function in routers/.
   → Thin. One responsibility: validate input, call service, return model.

6. Register the router in main.py if it's a new router file.

7. Update backend/docs/API.md with the full endpoint spec.

8. Update backend/docs/backend_doc.md if the architecture changed.

9. Write the migration if needed and add it to the migration order list in schema.md.

10. Verify: Does this endpoint need service role? If yes, add it to Section 9 above.
```

---

## 12. Performance Constraints

| Constraint | Value | Enforcement |
|---|---|---|
| Advisory P50 latency | ≤ 2000ms | Measured in `audit_writer`, alerted if exceeded |
| ML service timeout | 5 seconds | `httpx.AsyncClient(timeout=5)` |
| Dify timeout | 8 seconds | `httpx.AsyncClient(timeout=8)` |
| Context assembly DB reads | Single asyncio.gather | No sequential awaits allowed |
| Audio retention | 0 bytes | Transcribe-and-discard in memory |
| Max request body | 10MB (images) | Configured in FastAPI middleware |

If a change threatens any of these, document the tradeoff in a `# PERFORMANCE NOTE:` comment in the code and in `backend_doc.md`.

---

## 13. Future-Proofing Conventions

These patterns exist specifically so future agents and developers do not break things when extending the system.

**Versioned API prefix.** All routes are mounted under `/api/v1/`. When a breaking change is needed, introduce `/api/v2/` — never mutate a v1 contract.

**Feature flags via config.** New features that are not ready for all farmers should be gated with a `settings.feature_<name>_enabled: bool = False` flag, not by commenting out code.

**Multilingual-ready responses.** Do not hardcode response strings in routers or services. If user-facing strings are ever needed (error messages, advisory metadata), put them in a `i18n/` directory keyed by language code matching `farmers.preferred_language`.

**ML microservice contract versioning.** Each ML microservice exposes a `/health` and `/version` endpoint. When calling a microservice, log its version in `advisory_messages` metadata if the schema supports it. This enables post-hoc model performance attribution.

**Reference tables are immutable through application code.** `ref_crops`, `ref_locations`, `ref_knowledge_documents` are read-only for all application code. Updates happen only through numbered SQL migrations.

---

## 14. Quick Reference — Supabase Client Instantiation

```python
# dependencies.py

from supabase import create_async_client, AsyncClient
from config import settings

async def get_supabase() -> AsyncClient:
    """Farmer-scoped client — uses anon key + user JWT. RLS is active."""
    return await create_async_client(settings.supabase_url, settings.supabase_anon_key)

async def get_supabase_service() -> AsyncClient:
    """Service role client — bypasses RLS. Use ONLY for ML output writes and audit writes."""
    return await create_async_client(settings.supabase_url, settings.supabase_service_role_key)
```

---

## 15. Failure Modes and Recovery

| Failure | Response Strategy |
|---|---|
| Dify unreachable | Return 503 with `Retry-After: 30`. Do not write an advisory_messages row with a null response. |
| ML microservice timeout | Log warning, set `ml_outputs: null` in context block, continue advisory pipeline. |
| Open-Meteo unreachable | Log warning, set `weather: {}` in context block, continue advisory pipeline. |
| Supabase DB unreachable | Return 503. Do not retry indefinitely — let the PWA's deferred sync handle it. |
| Whisper transcription failure | Return 422 with actionable message to the PWA. Do not fall back to empty text. |
| Context assembly partial failure (one query fails) | Log error and return 503 — a partial context block is worse than no context block. |

---

*BACKEND_SKILL.md v1.0 — Krishi Sakhi backend engineering standard*
*This document is the source of truth for all agentic backend work. Update it before making architectural changes.*
