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
    transcriber_url: str = "http://localhost:8004"
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    advisory_timeout_seconds: int = 8
    ml_timeout_seconds: int = 5
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    class Config:
        env_file = ".env"

settings = Settings()
