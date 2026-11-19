from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "G4LMS API"
    api_prefix: str = "/api"

    # Neo4j (Graph Read & Adaptive Path Engine)
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    neo4j_database: str = "neo4j"

    # PostgreSQL (Transactional DB, doc_chunk, ai_proposal_item, outbox_events)
    postgres_dsn: str = ""

    # Redis (LLM Cache, Course Content Cache, Job Queue)
    redis_url: str = ""

    # MinIO / S3 (Object Storage for PDF, Slide, Media)
    s3_endpoint_url: str = ""
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = ""
    s3_bucket: str = "g4lms-materials"
    s3_region: str = "us-east-1"

    # External LLM & AI Gateway
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.0-flash"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    llm_cache_ttl_seconds: int = 86400

    # Security & Uploads
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins_csv: str = "http://localhost:5173,http://localhost:8080"
    upload_dir: Path = Path(__file__).resolve().parents[2] / "uploads"
    max_upload_size_bytes: int = 50 * 1024 * 1024

    # When true (or when dedicated workers aren't running separately), API can trigger in-process fallback
    inline_workers: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_csv.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
