"""Openfeed backend — FastAPI entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import accounts, feed, media
from .services import poller

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    import os

    if os.environ.get("OPENFEED_DISABLE_POLLER") != "1":
        poller.start()
    yield
    poller.shutdown()


app = FastAPI(title="Openfeed", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(feed.router)
app.include_router(media.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
