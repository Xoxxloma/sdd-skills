"""Тела событий. Схема очередей — в config/app.yaml."""
from dataclasses import dataclass


@dataclass
class VaccinationRecorded:
    """Тело vet.vaccination.recorded."""

    pet_id: str
    vaccine_code: str
    done_at: str  # ISO-8601, UTC
    clinic_id: str
    # Владелец в тело НЕ кладётся: подписчики берут его из vetcare-api запросом,
    # потому что владелец мог смениться между вакцинацией и доставкой события.


@dataclass
class OwnerMerged:
    """Тело crm.owner.merged — приходит извне, читается частично."""

    winner_owner_id: str
    loser_owner_id: str
    merged_at: str
    source_system: str
