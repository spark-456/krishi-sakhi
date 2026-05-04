# 🚜 Krishi Sakhi — Setup Guide

Complete guide to run the Krishi Sakhi platform locally. The system consists of a FastAPI backend, a React frontend, and four ML microservices.

---

## 📋 Prerequisites

- **Python 3.11+** with `venv`
- **Node.js 18+**
- **Supabase Project** (Database + Auth + Storage)
- **Dify Instance** (self-hosted or cloud — RAG advisory)
- **Groq API Key** (STT + LLM fallback)

---

## 🛠️ Step 1: Environment Setup

### Backend

Copy the template and fill in your API keys:

```bash
cd backend
cp .env.example .env
```

Required keys (see `backend/.env.example` for all options):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DIFY_API_URL=http://localhost/v1
DIFY_API_KEY=app-xxx
GROQ_API_KEY=gsk_xxx
```

Keep real values only in local `.env` files. Do not commit service-role keys, API keys, or Git credentials into tracked files.

The backend also reads from a root-level `.env` if present.

### Frontend

```bash
cd frontend
cp .env.example .env
```

Required keys:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Optional key:
```env
# Only set this if your backend is not on port 8000 or lives on a different host.
# If omitted, the frontend derives the backend host from the current app URL and
# targets port 8000 automatically. This makes LAN/Wi-Fi IP changes much safer.
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🧠 Step 2: Start ML Microservices

Each ML model runs as an independent service on a dedicated port. Open four separate terminals:

### 1. Soil Classifier (Port 8001)
*YOLOv8n — classifies soil surface images into 6 soil types.*
```bash
cd ml/soil_classifier
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

### 2. Crop Recommender (Port 8002)
*Random Forest — recommends crops based on NPK, pH, weather inputs.*
```bash
cd ml/crop_recommender
pip install -r requirements.txt
uvicorn main:app --port 8002 --reload
```

### 3. Price Forecaster (Port 8003)
*Prophet — provides 7–14 day directional mandi price signals.*
```bash
cd ml/price_forecaster
pip install -r requirements.txt
uvicorn main:app --port 8003 --reload
```

### 4. Plant Disease Classifier (Port 8004)
*MobileNetV2 — classifies crop diseases from leaf images (38 classes).*
```bash
cd ml/plant_disease_classifier
pip install -r requirements.txt
python download_model.py        # Downloads Hugging Face model on first run
uvicorn main:app --port 8004 --reload
```

Verify any service is live:
```bash
curl http://127.0.0.1:800X/health
# Expected: {"status": "ok"}
```

> **Note:** If an ML service is unavailable, the backend returns a deterministic stub response so the app remains functional.

---

## ⚙️ Step 3: Start the Backend

```bash
cd backend
.\venv\Scripts\Activate.ps1       # Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Backend API: **http://localhost:8000**
- Swagger docs: **http://localhost:8000/docs**
- Health check: **http://localhost:8000/health**

If you are enabling the notifications feed and proactive nudges on a fresh database, apply the latest Supabase migration set before launching the backend.

---

## 💻 Step 4: Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

- Frontend UI: **http://localhost:5173**

---

## ✅ Service Mapping Summary

| Service | Port | Model / Technology |
|:---|:---|:---|
| **Main Backend** | 8000 | FastAPI — core logic, auth, context assembly, STT/TTS |
| **Soil Classifier** | 8001 | YOLOv8n (Ultralytics, classification mode) |
| **Crop Recommender** | 8002 | Random Forest (scikit-learn) |
| **Price Forecaster** | 8003 | Prophet (Meta) + rule-based fallback |
| **Plant Disease Classifier** | 8004 | MobileNetV2 (Hugging Face) |
| **Frontend** | 5173 | React + Vite PWA |

---

## 📡 API Endpoints Reference

### Health
- `GET /health` — Backend status check

### Advisory & Voice
- `POST /api/v1/advisory/sessions` — Create advisory session
- `PATCH /api/v1/advisory/sessions/{session_id}` — End session
- `POST /api/v1/advisory/ask` — Submit text question (can also execute AskSakhi actions like farm/crop creation, expense logs, tickets, and help requests)
- `POST /api/v1/advisory/voice-chat` — Submit voice question (audio → STT → Dify → TTS)

### Farms
- `GET /api/v1/farms` — List all farms
- `POST /api/v1/farms` — Create farm
- `PATCH /api/v1/farms/{farm_id}` — Update farm
- `DELETE /api/v1/farms/{farm_id}` — Delete farm

### Crops
- `GET /api/v1/crops` — List crops (filter by `farm_id`)
- `POST /api/v1/crops` — Create crop record
- `PATCH /api/v1/crops/{crop_id}` — Update crop
- `PATCH /api/v1/crops/{crop_id}/status` — Update crop status

### Expenses
- `GET /api/v1/expenses` — List expenses (filters: `crop_record_id`, `farm_id`, date range)
- `POST /api/v1/expenses` — Create expense entry
- `DELETE /api/v1/expenses/{expense_id}` — Delete expense

### Farm Activity
- `GET /api/v1/activity` — List activity logs
- `POST /api/v1/activity` — Log a farm activity
- `DELETE /api/v1/activity/{activity_id}` — Remove activity

### ML Scans
- `POST /api/v1/scans/soil` — Upload soil image for classification
- `POST /api/v1/scans/pest` — Upload pest/disease image for classification
- `GET /api/v1/scans/soil` — List soil scan history
- `GET /api/v1/scans/pest` — List pest scan history

### ML Insights
- `GET /api/v1/ml-insights/crop-recommendation` — Get AI crop recommendation for a farm
- `GET /api/v1/ml-insights/price-forecast` — Get price forecast for a crop

### Weather
- `GET /api/v1/weather` — Get live weather for farmer's district

### Notifications
- `GET /api/v1/notifications` — List notification feed + unread count
- `PATCH /api/v1/notifications/{notification_id}` — Mark one notification read/unread
- `POST /api/v1/notifications/mark-all-read` — Mark all notifications as read
- `POST /api/v1/notifications/generate-nudges` — Admin-only manual nudge generation trigger

### Auth
- `POST /api/v1/auth/register` — Register new user (creates Supabase auth + farmer row)

### Admin (KVK Extension Workers) - Require role='admin'
- `GET /api/v1/admin/dashboard` — Get admin stats (total farmers, open tickets, posts)
- `GET /api/v1/admin/farmers` — List all farmers
- `GET /api/v1/admin/network-graph` — D3 network graph data mapping all connections
- `GET /api/v1/admin/tickets` — Manage farmer tickets
- `GET/POST /api/v1/admin/blog` — Manage KVK blog posts
- `POST /api/v1/admin/blog/seed-demo` — Seed representative published blog posts for demo/admin review

### Cooperative (SakhiNet)
- `GET/POST /api/v1/cooperative/groups` — Find or create cooperative groups
- `GET /api/v1/cooperative/my-groups` — List joined groups
- `GET/POST /api/v1/cooperative/groups/{id}/resources` — Manage shared resources (equipment/seeds)
- `GET/POST /api/v1/cooperative/groups/{id}/help-requests` — Ask the community for help
- `GET/POST /api/v1/cooperative/groups/{id}/messages` — Chat with group members

---

## 📱 LAN Mobile Testing (Phone ↔ Laptop)

To test the application natively on your phone using your laptop's camera and voice features:

1. **Find your laptop's IP address** (e.g., `192.168.1.3`).
2. **Backend Setup:**
   Run the backend on `0.0.0.0` to expose it to your network:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
3. **Frontend Setup:**
   Start Vite:
   ```bash
   npm run dev
   ```
   By default, the frontend now follows the same host that served the app and targets backend port `8000`. That means if your laptop IP changes from one network to another, you usually do **not** need to edit `frontend/.env` again.

   Only set `VITE_API_BASE_URL` if:
   - your backend runs on a different port
   - your backend is on another machine
   - you are intentionally targeting a fixed host or tunnel

   Example optional override:
   ```env
   VITE_API_BASE_URL=http://192.168.1.3:8000
   ```
   *(Vite is already configured to expose its port to `0.0.0.0` and run with `@vitejs/plugin-basic-ssl` to enable HTTPS, which is strictly required by browsers for camera and microphone access).*
4. **Connect via Phone:**
   Open your phone's browser and go to: `https://192.168.1.3:5173`
   *(Accept the self-signed SSL certificate warning if prompted).*

---

## 🚀 Troubleshooting

1. **Port Conflicts:** Kill the process using `npx kill-port <port_number>` or Task Manager.
2. **Missing Model Files:** Ensure `ml/` folders contain their respective `.pkl`, `.json`, or `.pt` files before starting microservices.
3. **Database Connectivity:** Verify Supabase URL and keys in `.env`. Ensure RLS policies are properly configured.
4. **Plant Disease Model Says "Early Blight 88%":** This is the stub response — it means the backend cannot reach `http://localhost:8004`. Start the plant disease service first.
5. **Dify Not Responding:** Check that Dify is running and `DIFY_API_URL` + `DIFY_API_KEY` are correct. The backend falls back to Groq direct LLM call if Dify fails.
6. **CORS Errors:** Ensure your frontend URL (including the IP address if testing via mobile) is included in the CORS settings.
7. **Camera/Microphone Blocked on Mobile:** Browsers block `getUserMedia()` on non-HTTPS origins except `localhost`. Ensure you are using `https://` with the LAN IP.
## 🚀 Demo Access

For quick demonstration and testing, use the following pre-configured accounts.

### 📱 Demo Farmer Account
*   **Phone:** `+919999999999`
*   **OTP:** `123456`
*   **Purpose:** Explore the app from a farmer's perspective (Dashboard, Farms, SakhiNet, etc.).

### 🛡️ Demo Admin Account
*   **Phone:** `+918888888888`
*   **OTP:** `123456`
*   **Portal URL:** After logging in with the admin phone number, navigate to `https://[IP_OR_LOCALHOST]:5173/admin`
*   **Purpose:** Access the Admin Dashboard, view the Farmer Network Graph, manage tickets, and publish blog posts.

---

### 📊 Seeding Demo Data
If you need to re-populate the database with ~200 realistic Telangana-based farmers and community data:
```bash
python backend/scripts/populate_demo_data.py
```
*Note: Ensure your `SUPABASE_SERVICE_ROLE_KEY` is set in the root `.env` file before running.*

To seed representative admin blog posts from the CLI:
```bash
python backend/scripts/seed_demo_blogs.py
```

To manually generate proactive notification nudges:
```bash
python backend/scripts/run_notification_nudges.py
```
