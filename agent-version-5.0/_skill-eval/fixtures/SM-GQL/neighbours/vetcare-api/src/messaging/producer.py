"""Публикация событий наружу."""
from .events import VaccinationRecorded

ROUTING_KEY = "vet.vaccination.recorded"


async def vaccination_recorded(vaccination) -> None:
    """Публикуется ПОСЛЕ коммита транзакции, отдельным вызовом.

    Из этого следует две вещи, которых по имени события не видно:
    при ретрае публикации возможен дубль, а при падении процесса между коммитом и
    отправкой события не будет вовсе — прививка в базе останется, событие потеряется.
    Ключ маршрутизации фиксированный, порядок между питомцами не гарантирован.
    """
    body = VaccinationRecorded(
        pet_id=vaccination.pet_id,
        vaccine_code=vaccination.vaccine_code,
        done_at=vaccination.done_at.isoformat(),
        clinic_id=vaccination.clinic_id,
    )
    await _publish(ROUTING_KEY, body)
