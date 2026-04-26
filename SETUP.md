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
source venv/bin/activate           # macOS/Linux

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Backend API: **http://localhost:8000**
- Swagger docs: **http://localhost:8000/docs**
- Health check: **http://localhost:8000/health**

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
- `POST /api/v1/advisory/ask` — Submit text question (triggers context assembly + Dify RAG + TTS audio)
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

### Auth
- `POST /api/v1/auth/register` — Register new user (creates Supabase auth + farmer row)

### Admin (KVK Extension Workers) - Require role='admin'
- `GET /api/v1/admin/dashboard` — Get admin stats (total farmers, open tickets, posts)
- `GET /api/v1/admin/farmers` — List all farmers
- `GET /api/v1/admin/network-graph` — D3 network graph data mapping all connections
- `GET /api/v1/admin/tickets` — Manage farmer tickets
- `GET/POST /api/v1/admin/blog` — Manage KVK blog posts

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
   Update your `frontend/.env` to point to your laptop's IP:
   ```env
   VITE_API_BASE_URL=http://192.168.1.3:8000
   ```
   Start Vite:
   ```bash
   npm run dev
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
