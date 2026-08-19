"""Доступ к базе. Здесь же живут фильтры «по умолчанию» — то, чего не видно по имени операции."""
from datetime import datetime, timedelta

from .entities import Appointment, Clinic, Pet, Vaccination

# Карта прививок отдаётся за последние три года. Всё, что старше, лежит в архивном
# сервисе клиники и через этот сервис недоступно.
VACCINATION_WINDOW_YEARS = 3


async def appointments_in_period(clinic_id: str, date_from: str, date_to: str) -> list[Appointment]:
    # Отменённые приёмы в выдачу НЕ попадают: расписание клиники показывает только живые
    # слоты. Чтобы увидеть отменённые, их запрашивают поимённо через appointment(id).
    return await _query(
        "SELECT * FROM appointments "
        "WHERE clinic_id = %s AND slot_at BETWEEN %s AND %s AND status <> 'cancelled' "
        "ORDER BY slot_at",
        clinic_id, date_from, date_to,
    )


async def appointment_by_id(appointment_id: str) -> Appointment | None:
    return await _query_one("SELECT * FROM appointments WHERE id = %s", appointment_id)


async def appointment_by_idempotency_key(key: str) -> Appointment | None:
    return await _query_one(
        "SELECT * FROM appointments WHERE idempotency_key = %s AND created_at > now() - interval '24 hours'",
        key,
    )


async def vaccination_card(pet_id: str) -> list[Vaccination]:
    since = datetime.utcnow() - timedelta(days=365 * VACCINATION_WINDOW_YEARS)
    return await _query(
        "SELECT * FROM vaccinations WHERE pet_id = %s AND done_at >= %s ORDER BY done_at DESC",
        pet_id, since,
    )


async def pets_of_owner(owner_id: str) -> list[Pet]:
    # Снятые с учёта питомцы остаются в выдаче: владелец должен видеть их историю.
    return await _query("SELECT * FROM pets WHERE owner_id = %s ORDER BY name", owner_id)


async def all_clinics() -> list[Clinic]:
    return await _query("SELECT * FROM clinics ORDER BY name")
