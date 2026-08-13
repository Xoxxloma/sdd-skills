"""Справочник клиник и подписка на смену статуса приёма."""
from typing import AsyncGenerator

import strawberry

from ..domain import repository
from ..domain.entities import Appointment, Clinic
from ..security.roles import current_user


async def clinics() -> list[Clinic]:
    """Справочник клиник сети."""
    return await repository.all_clinics()


async def appointment_status_changed(info: strawberry.Info) -> AsyncGenerator[Appointment, None]:
    """Поток смен статуса приёма.

    Подписчик получает события ТОЛЬКО по своей клинике: фильтр стоит здесь, на сервере,
    и параметра клиники у подписки нет — подменить её с клиента нельзя.
    """
    user = current_user(info)
    async for changed in repository.appointment_status_stream():
        if changed.clinic_id == user.clinic_id:
            yield changed
