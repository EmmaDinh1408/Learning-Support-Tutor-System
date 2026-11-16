from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "G4LMS API"
    api_prefix: str = "/api"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    neo4j_database: str = "neo4j"
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins_csv: str = "http://localhost:5173"
    upload_dir: Path = Path(__file__).resolve().parents[2] / "uploads"
    max_upload_size_bytes: int = 50 * 1024 * 1024

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_csv.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()