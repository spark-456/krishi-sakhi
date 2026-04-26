from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    dify_api_url: str = ""
    dify_api_key: str = ""
    soil_classifier_url: str = "http://localhost:8001"
    crop_recommender_url: str = "http://localhost:8002"
    price_forecaster_url: str = "http://localhost:8003"
    plant_disease_classifier_url: str = "http://localhost:8004"
    transcriber_url: str = "http://localhost:8005"
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    advisory_timeout_seconds: int = 30
    ml_timeout_seconds: int = 5
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"]

    elevenlabs_api_key: str = ""
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    elevenlabs_voice_id: str = "EXAVITQu4vr4xnSDxMaL"
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_direct_search_enabled: bool = False

    class Config:
        env_file = [".env", "../.env"]
        extra = "ignore"

settings = Settings()
