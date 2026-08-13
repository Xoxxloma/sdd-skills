"""Резолверы приёмов. Правила и ограничения живут в domain/appointments_service.py."""
import strawberry

from ..domain import appointments_service as svc
from ..domain.entities import Appointment


async def appointments(clinic_id: str, date_from: str, date_to: str) -> list[Appointment]:
    """Приёмы клиники за период."""
    return await svc.list_for_clinic(clinic_id, date_from, date_to)


async def appointment(id: strawberry.ID) -> Appointment | None:
    """Один приём по идентификатору."""
    return await svc.by_id(str(id))


async def book(
    pet_id: strawberry.ID,
    slot_at: str,
    vet_id: strawberry.ID,
    idempotency_key: str,
) -> Appointment:
    """Запись питомца на приём."""
    return await svc.book(str(pet_id), slot_at, str(vet_id), idempotency_key)


async def cancel(id: strawberry.ID, reason: str) -> Appointment:
    """Отмена приёма клиентом или регистратурой."""
    return await svc.cancel(str(id), reason)
