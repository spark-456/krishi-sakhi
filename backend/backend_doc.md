# Krishi Sakhi Backend Documentation

## Architecture
The Krishi Sakhi backend is built using FastAPI. It leverages modular routing to divide domain logic into `farms.py`, `crops.py`, `expenses.py`, and `activity.py`.

## Data Validation
Pydantic V2 models are used to ensure schema compliance for all incoming and outgoing payloads. The Pydantic models closely map to the properties listed in `schema.md`.

## Database Interaction
The Supabase Python Client injects via dependency injection (`Depends(get_supabase)`). The primary authentication method checks the Supabase JWT forwarded from the frontend, ensuring RLS policies apply appropriately when making database calls via the service role logic if needed, although CRUD operations use the user JWT where applicable.

Please refer to `docs/API.md` for specific endpoint routes and query parameters.
