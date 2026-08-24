from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, telegram
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Vireli API",
    version="0.1.0",
    description="Backend for the Vireli Telegram Mini App (AI Content Studio).",
)

# The Mini App is loaded inside Telegram's webview from our GitHub Pages
# origin. Only that origin (plus localhost for development) is allowed
# to call this API from a browser context.
allowed_origins = [settings.frontend_origin, "http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(telegram.router, prefix="/api")


@app.get("/")
def root():
    return {"service": "vireli-backend", "status": "running"}

