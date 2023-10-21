"""Router setup for the v1 version of the API."""

# ruff: noqa: D103

import asyncio
import logging
import secrets
from base64 import b64decode

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.responses import Response
from fastapi.security.utils import get_authorization_scheme_param
from fastapi.security import HTTPAuthorizationCredentials

from spoolman import env
from spoolman.database.database import backup_global_db
from spoolman.exceptions import ItemNotFoundError
from spoolman.ws import websocket_manager

from . import filament, models, other, spool, vendor

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Spoolman REST API v1",
    version="1.0.0",
    description="""
    REST API for Spoolman.

    The API is served on the path `/api/v1/`.

    Some endpoints also serve a websocket on the same path. The websocket is used to listen for changes to the data
    that the endpoint serves. The websocket messages are JSON objects. Additionally, there is a root-level websocket
    endpoint that listens for changes to any data in the database.
    """,
)

basic_auth_activated = env.basic_auth_activated()
basic_auth_username = env.get_basic_auth_username()
basic_auth_password = env.get_basic_auth_password()

def decode_and_check_basic_auth_or_raise(encoded_credentials: str):
    decoded_credentials: str | None = None
    try:
        decoded_credentials = b64decode(encoded_credentials).decode("ascii")

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="invalid token",
        )

    username, _, password = decoded_credentials.partition(":")
    username_is_valid = secrets.compare_digest(username, basic_auth_username)
    password_is_valid = secrets.compare_digest(password, basic_auth_password)

    if not username_is_valid or not password_is_valid:
        raise HTTPException(
            status_code=401,
            detail="invalid username/password",
        )

    # everything is fine, just return
    return


@app.middleware("http")
async def check_auth(request: Request, call_next):
    if not basic_auth_activated:
        return await call_next(request)

    auth_header = request.headers.get('Authorization') or request.headers.get('authorization')

    # auth expected but non given?
    if basic_auth_activated and auth_header is None:
        raise HTTPException(
            status_code=401,
            detail="no auth given",
        )

    auth_scheme, auth_token = get_authorization_scheme_param(auth_header)

    # basic? decode and check username/password
    if auth_scheme.lower() == "basic":
        decode_and_check_basic_auth_or_raise(auth_token)
        return await call_next(request)

    # TBD.. if auth_scheme.lower() == "bearer":

    raise HTTPException(
        status_code=401,
        detail="invalid authentication method",
    )


@app.exception_handler(ItemNotFoundError)
async def itemnotfounderror_exception_handler(_request: Request, exc: ItemNotFoundError) -> Response:
    logger.debug(exc, exc_info=True)
    return JSONResponse(
        status_code=404,
        content={"message": exc.args[0]},
    )


# Add a general info endpoint
@app.get("/info")
async def info() -> models.Info:
    """Return general info about the API."""
    return models.Info(
        version=env.get_version(),
        debug_mode=env.is_debug_mode(),
        automatic_backups=env.is_automatic_backup_enabled(),
        data_dir=str(env.get_data_dir().resolve()),
        backups_dir=str(env.get_backups_dir().resolve()),
        db_type=str(env.get_database_type() or "sqlite"),
        git_commit=env.get_commit_hash(),
        build_date=env.get_build_date(),
    )


# Add health check endpoint
@app.get("/health")
async def health() -> models.HealthCheck:
    """Return a health check."""
    return models.HealthCheck(status="healthy")


# Add endpoint for triggering a db backup
@app.post(
    "/backup",
    description="Trigger a database backup. Only applicable for SQLite databases.",
    response_model=models.BackupResponse,
    responses={500: {"model": models.Message}},
)
async def backup():  # noqa: ANN201
    """Trigger a database backup."""
    path = await backup_global_db()
    if path is None:
        return JSONResponse(
            status_code=500,
            content={"message": "Backup failed. See server logs for more information."},
        )
    return models.BackupResponse(path=str(path))


@app.websocket(
    "/",
    name="Listen to any changes",
)
async def notify(
    websocket: WebSocket,
) -> None:
    await websocket.accept()
    websocket_manager.connect((), websocket)
    try:
        while True:
            await asyncio.sleep(0.5)
            if await websocket.receive_text():
                await websocket.send_json({"status": "healthy"})
    except WebSocketDisconnect:
        websocket_manager.disconnect((), websocket)


# Add routers
app.include_router(filament.router)
app.include_router(spool.router)
app.include_router(vendor.router)
app.include_router(other.router)
