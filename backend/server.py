"""
SmartClix backend — application entry point.

This file is intentionally small. Wiring lives in the `app/` package:

  app/config.py       env loading
  app/db.py           Mongo client + db handle
  app/security.py     bcrypt, JWT, cookies, client-IP helpers
  app/models.py       Pydantic DTOs
  app/deps.py         FastAPI dependencies (auth, RBAC)
  app/brute_force.py  login lockout
  app/indexes.py      Mongo indexes (resilient — failures log only)
  app/seed.py         admin/reviewer seeding
  app/routes/         HTTP routers (health, auth, operators)

The contract is:
  - One concern per module.
  - Lower-level modules never import higher-level ones.
  - Startup errors are isolated: index/seed failures log but don't crash.
"""
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ORIGINS, FRONTEND_BUILD_DIR
from app.db import close_db
from app.indexes import ensure_indexes
from app.routes import api_router
from app.seed import seed_operators

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)

app = FastAPI(title="SmartClix Operator Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


# ---- serve the built frontend in production (single-service deploy) ----
# Dev: React runs on :3000 and FRONTEND_BUILD_DIR is unset, so this is skipped.
# Prod: the Docker image builds the SPA and points FRONTEND_BUILD_DIR at it, so
# the app and /api share one origin (no CORS, simplest cookies).
_frontend = (
    Path(FRONTEND_BUILD_DIR)
    if FRONTEND_BUILD_DIR
    else Path(__file__).resolve().parent.parent / "frontend" / "build"
)
if (_frontend / "index.html").exists():
    app.mount("/static", StaticFiles(directory=_frontend / "static"), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Unmatched /api/* should return JSON 404, not the SPA shell.
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(_frontend / "index.html")

    logging.getLogger("smartclix").info("Serving frontend from %s", _frontend)


@app.on_event("startup")
async def on_startup() -> None:
    await ensure_indexes()
    await seed_operators()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_db()
