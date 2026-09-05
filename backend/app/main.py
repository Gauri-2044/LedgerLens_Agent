from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes.uploads import uploads_route
from app.routes.reconcile import reconcile_route
from app.routes.dashboard import dashboard_route

app = FastAPI(
    title="LedgerLens AI Agent",
    description="A agent to validate and match transaction records and investigate any fault",
    version="1.0.0",
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(uploads_route)
app.include_router(reconcile_route)
app.include_router(dashboard_route)


@app.get("/health")
def check_health():
    return {"message": "OK Running Perfectly Fine !!"}

# No app.run() - uses ASGI (Asynchronous Server Gateway Interface)
