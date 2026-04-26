# 🚜 Krishi Sakhi - Setup Guide

This guide will help you get the full Krishi Sakhi platform running locally. The system consists of a FastAPI backend, a React frontend, and four specialized ML microservices.

## 📋 Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **Supabase Project** (Database + Auth)
- **Dify.ai Account** (For AI Advisory features)

---

## 🛠️ Step 1: Environment Setup

Ensure you have a `.env` file in the **root directory** with the following keys filled:

```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

DIFY_API_KEY=your_dify_key
OPENROUTER_API_KEY=your_openrouter_key
```

---

## 🧠 Step 2: Start ML Microservices

Each ML model runs as an independent service on a dedicated port. Open four separate terminals:

### 1. Soil Classifier (Port 8001)
*Used for camera-based soil analysis.*
```bash
cd ml/soil_classifier
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

### 2. Crop Recommender (Port 8002)
*Used for AI-based crop suggestions on the dashboard.*
```bash
cd ml/crop_recommender
pip install -r requirements.txt
uvicorn main:app --port 8002 --reload
```

### 3. Price Forecaster (Port 8003)
*Used for market momentum signals and price trends.*
```bash
cd ml/price_forecaster
pip install -r requirements.txt
uvicorn main:app --port 8003 --reload
```

### 4. Plant Disease Classifier (Port 8004)
*Used for camera-based crop pest and disease detection.*
```bash
cd ml/plant_disease_classifier
pip install -r requirements.txt
python download_model.py
uvicorn main:app --port 8004 --reload
```

Verify it is live before testing the camera flow:
```bash
curl http://127.0.0.1:8004/health
```
Expected result:
- `"status": "ok"`
- `"source": "local"` once the model files have been downloaded

If this service is not running, the backend currently falls back to the stub response:
- `Early Blight`
- `88% confidence`
- `mode: "stub"`

---

## ⚙️ Step 3: Start the Backend Service

The main backend orchestrates data and connects the frontend to the ML models.

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
*The backend runs on **http://localhost:8000**.*

---

## 💻 Step 4: Start the Frontend

The React UI provides the dashboard and tools for the farmer.

```bash
cd frontend
npm install
npm run dev
```
*The UI will be available at **http://localhost:5173** (or 3000).*

---

## ✅ Service Mapping Summary

| Service | Port | Description |
| :--- | :--- | :--- |
| **Main Backend** | 8000 | Core Logic & API Gateway |
| **Soil Classifier** | 8001 | Image Prediction (VGG/Inception) |
| **Crop Recommender** | 8002 | XGBoost Training/Inference |
| **Price Forecaster** | 8003 | Pandas Historical Analysis |
| **Plant Disease Classifier** | 8004 | Hugging Face MobileNetV2 Image Classification |
| **Frontend** | 5173 | React Dashboard & UI |

---

## 🚀 Troubleshooting

1. **Port Conflicts:** If a port is already in use, you can kill the process using `npx kill-port <port_number>` or Task Manager.
2. **Missing Metadata:** Ensure the `ml/` folders contain their respective `.pkl`, `.json`, or downloaded Hugging Face model files before starting the microservices.
3. **Database Connectivity:** Ensure your IP address is whitelisted in Supabase or that RLS policies are properly configured.
4. **Plant Disease Model Always Says Early Blight 88%:** This means the backend is not reaching `http://localhost:8004`. Check the plant disease terminal first and confirm `http://127.0.0.1:8004/health` returns `status: ok`.
