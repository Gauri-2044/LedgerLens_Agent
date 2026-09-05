from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes.uploads import uploads_route
from app.routes.reconcile import reconcile_route
from app.routes.dashboard import dashboard_route

app = FastAPI(
    title="LedgerLens AI Agent",
    description="An autonomous agent to validate and match transaction records and investigate financial exceptions",
    version="1.0.0",
)

# CORS — allow frontend dev & production domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for Vercel deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(uploads_route)
app.include_router(reconcile_route)
app.include_router(dashboard_route)


@app.get("/")
def root():
    return {
        "status": "online",
        "app": "LedgerLens AI Reconciliation Engine",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def check_health():
    return {"message": "OK Running Perfectly Fine !!"}