"""Сущности, за которые сервис — единственный источник правды."""
from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class AppointmentStatus(str, Enum):
    BOOKED = "booked"
    DONE = "done"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


@dataclass
class Pet:
    id: str
    owner_id: str
    name: str
    species: str  # dog | cat | ferret | bird
    chip_id: str | None  # None у питомцев без чипа: чипирование добровольное
    # None значит «не взвешивали», а не ноль: вес приезжает с первого приёма.
    weight_kg: float | None
    archived_at: datetime | None


@dataclass
class Appointment:
    id: str
    pet_id: str
    clinic_id: str
    vet_id: str
    slot_at: datetime
    status: AppointmentStatus
    # Заполняется только у отменённых; у остальных None.
    cancel_reason: str | None


@dataclass
class Vaccination:
    id: str
    pet_id: str
    vaccine_code: str
    done_at: datetime
    # Дата следующей прививки считается по справочнику вакцин, который лежит
    # в лабораторном сервисе; здесь хранится уже посчитанное значение.
    next_due_at: datetime | None


@dataclass
class Clinic:
    """Справочник клиник сети.

    Ведётся этим сервисом и только им: таблицу заводит миграция V1, соседи читают
    справочник через `query clinics`. Другого источника правды по клиникам в системе нет.
    """

    id: str
    name: str
    address: str
