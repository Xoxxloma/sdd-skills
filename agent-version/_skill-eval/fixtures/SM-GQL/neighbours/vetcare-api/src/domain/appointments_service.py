"""Правила записи и отмены приёма."""
from datetime import datetime, timedelta

from . import exceptions as ex
from . import repository
from .entities import Appointment, AppointmentStatus

# Отменить приём можно не позже чем за два часа до слота; дальше — только через регистратуру.
CANCEL_WINDOW_HOURS = 2


async def list_for_clinic(clinic_id: str, date_from: str, date_to: str) -> list[Appointment]:
    return await repository.appointments_in_period(clinic_id, date_from, date_to)


async def by_id(appointment_id: str) -> Appointment | None:
    return await repository.appointment_by_id(appointment_id)


async def book(pet_id: str, slot_at: str, vet_id: str, idempotency_key: str) -> Appointment:
    """Запись на приём.

    Идемпотентна по idempotency_key: повторный вызов с тем же ключом возвращает уже
    созданный приём и второго не заводит. Ключ живёт 24 часа.
    """
    existing = await repository.appointment_by_idempotency_key(idempotency_key)
    if existing is not None:
        return existing

    pet = await repository.pet_by_id(pet_id)
    if pet.archived_at is not None:
        raise ex.PetArchived(pet_id)
    if await repository.slot_busy(vet_id, slot_at):
        raise ex.SlotTaken(vet_id, slot_at)

    return await repository.insert_appointment(pet_id, slot_at, vet_id, idempotency_key)


async def cancel(appointment_id: str, reason: str) -> Appointment:
    appointment = await repository.appointment_by_id(appointment_id)
    if appointment.slot_at - datetime.utcnow() < timedelta(hours=CANCEL_WINDOW_HOURS):
        raise ex.CancelWindowPassed(appointment_id)
    return await repository.set_status(
        appointment_id, AppointmentStatus.CANCELLED, cancel_reason=reason
    )
