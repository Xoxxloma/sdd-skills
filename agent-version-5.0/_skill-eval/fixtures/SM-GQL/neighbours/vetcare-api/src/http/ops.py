"""Служебные REST-маршруты. Всё остальное сервис отдаёт через POST /graphql."""
from fastapi import APIRouter

from ..api.schema import schema

router = APIRouter()


@router.get("/healthz")
async def healthz():
    """Проверка живости для балансировщика."""
    return {"status": "ok"}


@router.get("/version")
async def version():
    """Версия сборки — читается мониторингом при выкатке."""
    return {"build": _BUILD, "schema_hash": schema.hash()}
