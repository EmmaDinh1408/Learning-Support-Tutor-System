from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, attendance, auth, communication, courses, coursework, dashboard, files
from app.api.routes import learning_graph, learning_profiles, quizzes, recommendations, sync

from app.core.config import get_settings
from app.infrastructure.neo4j.driver import close_driver, ensure_schema, run_read, verify_connectivity


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if len(settings.jwt_secret_key) < 32:
        raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters.")
    try:
        verify_connectivity()
        ensure_schema()
        yield
    finally:
        close_driver()


settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

for route_group in (
    auth.router,
    admin.router,
    courses.router,
    coursework.router,
    attendance.router,
    quizzes.router,
    files.router,
    communication.router,
    dashboard.router,
    learning_graph.router,
    learning_profiles.router,
    recommendations.router,
    sync.router,
):

    app.include_router(route_group, prefix=settings.api_prefix)


@app.get("/health")
def health() -> dict[str, str]:
    run_read("RETURN 1 AS connected")
    return {"status": "ok", "database": "neo4j"}