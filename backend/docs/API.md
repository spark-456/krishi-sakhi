# Krishi Sakhi FastAPI API Documentation

## Base URL
`http://localhost:8000/api/v1`

## Authentication
All endpoints (except `/health`) require a valid Supabase JWT sent in the `Authorization` header.
`Authorization: Bearer <JWT>`

## Endpoints

### Health
- `GET /health`
  Check backend status.

### Advisory & Voice
- `POST /advisory/sessions`
  Create a new advisory session.
- `PATCH /advisory/sessions/{session_id}`
  End an advisory session.
- `POST /advisory/ask`
  Submit a text question. Triggers context assembly, Dify RAG, and returns TTS audio payload.
- `POST /advisory/voice-chat`
  Submit a voice question (UploadFile). Returns STT transcription, text response, and TTS audio payload.

### Farms
- `GET /farms`
  List all farms for the authenticated farmer.
- `POST /farms`
  Create a new farm.
- `PATCH /farms/{farm_id}`
  Update farm details.
- `DELETE /farms/{farm_id}`
  Delete a farm.

### Crops
- `GET /crops?farm_id={optional}`
  List all crops. Filter by farm_id.
- `POST /crops`
  Create a new crop record.
- `PATCH /crops/{crop_id}`
  Update a crop record.
- `PATCH /crops/{crop_id}/status`
  Update the active status of a crop record.

### Expenses
- `GET /expenses?crop_record_id={optional}&farm_id={optional}&from={date}&to={date}`
  List expenses.
- `POST /expenses`
  Create a new expense entry.
- `DELETE /expenses/{expense_id}`
  Delete an expense entry.

### Farm Activity
- `GET /activity?farm_id={optional}&limit={50}`
  List activity logs.
- `POST /activity`
  Log a new farm activity.
- `DELETE /activity/{activity_id}`
  Remove an activity log.
