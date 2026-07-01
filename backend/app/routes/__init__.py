"""Public route registry."""
from fastapi import APIRouter

from app.routes import (
    approvals,
    auth,
    clients,
    connections,
    health,
    onboarding,
    operators,
    webhooks,
    workspaces,
    ws,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(operators.router, prefix="/operators", tags=["operators"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(workspaces.router, prefix="/clients", tags=["workspaces"])
api_router.include_router(onboarding.router, prefix="/clients", tags=["onboarding"])
api_router.include_router(onboarding.items_router, tags=["onboarding"])
api_router.include_router(connections.router, prefix="/clients", tags=["connections"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["approvals"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(ws.router, tags=["ws"])
