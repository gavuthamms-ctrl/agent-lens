"""Main FastAPI application entry point for AgentLens."""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

from app.db import init_db
from app.api.traces import router as traces_router
from app.api.demo import router as demo_router
from app.api.evaluate import router as evaluate_router
from app.api.export import router as export_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("agentlens")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    logger.info("Initializing AgentLens database...")
    init_db()
    mock_mode = os.getenv("MOCK_MODE", "true").lower() in ("true", "1", "yes")
    has_api_key = bool(os.getenv("ANTHROPIC_API_KEY", "").strip())
    logger.info(f"AgentLens started. MOCK_MODE: {mock_mode}, Anthropic Key Configured: {has_api_key}")
    yield
    logger.info("AgentLens shutting down.")


app = FastAPI(
    title="AgentLens API",
    description="LLM-based detection and analysis of communication defects in multi-agent systems (MAS).",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Size Limit Middleware (15 MB maximum payload)
MAX_PAYLOAD_BYTES = 15 * 1024 * 1024


@app.middleware("http")
async def check_content_length(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_PAYLOAD_BYTES:
        return JSONResponse(
            status_code=413,
            content={"detail": "Payload too large. Maximum allowed size is 15 MB."},
        )
    return await call_next(request)


# Register API Routers
app.include_router(traces_router, prefix="/api")
app.include_router(demo_router, prefix="/api")
app.include_router(evaluate_router, prefix="/api")
app.include_router(export_router, prefix="/api")


@app.get("/api/health")
def healthcheck():
    """System health check and runtime mode endpoint."""
    mock_mode = os.getenv("MOCK_MODE", "true").lower() in ("true", "1", "yes")
    has_api_key = bool(os.getenv("ANTHROPIC_API_KEY", "").strip())
    model_name = os.getenv("LLM_MODEL", "claude-3-5-sonnet-20241022")
    return {
        "status": "healthy",
        "mock_mode": mock_mode,
        "llm_model": model_name if has_api_key and not mock_mode else "heuristic_offline_engine",
        "api_key_configured": has_api_key,
    }


# Mount Samples Directory (for in-app sample loading)
samples_dir = os.path.join(os.path.dirname(__file__), "..", "samples")
samples_dir = os.path.abspath(samples_dir)
if os.path.exists(samples_dir):
    app.mount("/samples", StaticFiles(directory=samples_dir), name="samples")

# Mount Static Files (Frontend) — must be LAST mount
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
