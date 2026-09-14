from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes import vaults
from app.routes import credentials
from app.routes.security import router as security_router


# --------------------------------------------------
# FASTAPI APP
# --------------------------------------------------

app = FastAPI(
    title="VaultX API",
    description="Intelligent Password & Credential Security Platform",
    version="1.0.0",
)


# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_origin_regex=r"chrome-extension://.*",

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# --------------------------------------------------
# ROUTERS
# --------------------------------------------------

app.include_router(auth_router)

app.include_router(vaults.router)

app.include_router(credentials.router)

app.include_router(security_router)


# --------------------------------------------------
# ROOT ROUTE
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "VaultX Backend is running",
        "status": "success",
    }