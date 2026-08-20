"""Правила учёта питомцев и вакцинации."""
from . import exceptions as ex
from . import repository
from ..messaging import producer
from .entities import Pet, Vaccination


async def register(owner_id: str, name: str, species: str, chip_id: str | None) -> Pet:
    """Постановка на учёт.

    Уникальность держит база (индекс uq_pets_chip_id, миграция V3), а не эта проверка:
    две параллельные регистрации с одним чипом разойдутся именно на вставке.
    """
    try:
        return await repository.insert_pet(owner_id, name, species, chip_id)
    except repository.UniqueViolation as err:
        if "uq_pets_chip_id" in str(err):
            raise ex.ChipAlreadyUsed(chip_id) from err
        raise


async def record_vaccination(pet_id: str, vaccine_code: str, done_at: str) -> Vaccination:
    vaccination = await repository.insert_vaccination(pet_id, vaccine_code, done_at)
    await producer.vaccination_recorded(vaccination)
    return vaccination


async def transfer(pet_id: str, new_owner_id: str) -> Pet:
    """Передача другому владельцу.

    Вместе с владельцем меняется и расписание: все БУДУЩИЕ приёмы питомца отменяются
    со статусом cancelled и причиной owner_transfer — новый владелец записывается сам.
    Прошедшие приёмы и карта прививок остаются у питомца.
    """
    await repository.cancel_future_appointments(pet_id, reason="owner_transfer")
    return await repository.set_pet_owner(pet_id, new_owner_id)
