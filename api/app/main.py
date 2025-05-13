import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.routers import auth, workflows, executions, admin, ai, dashboard, aggregations, integrations, apps, mcp, departments
from app.services.scheduler import get_scheduler

logger = logging.getLogger("bento.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    scheduler = get_scheduler()
    try:
        await scheduler.start()
    except Exception as e:
        logger.error("Failed to start scheduler: %s", e)
    yield
    # Shutdown
    try:
        await scheduler.stop()
    except Exception as e:
        logger.error("Failed to stop scheduler: %s", e)


app = FastAPI(title="Bento API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(executions.router, prefix="/api/executions", tags=["executions"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(aggregations.router, prefix="/api/aggregations", tags=["aggregations"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])
app.include_router(apps.router, prefix="/api/apps", tags=["apps"])
app.include_router(mcp.router, prefix="/api/mcp", tags=["mcp"])
app.include_router(departments.router, prefix="/api/departments", tags=["departments"])


@app.get("/health")
def health():
    return {"status": "ok"}
