"""Резолверы питомцев и прививок. Правила — в domain/pets_service.py, выборки — в repository.py."""
import strawberry

from ..domain import pets_service as svc
from ..domain import repository
from ..domain.entities import Pet, Vaccination


async def pets(owner_id: strawberry.ID) -> list[Pet]:
    """Питомцы владельца."""
    return await repository.pets_of_owner(str(owner_id))


async def vaccination_card(pet_id: strawberry.ID) -> list[Vaccination]:
    """Карта прививок питомца."""
    return await repository.vaccination_card(str(pet_id))


async def register(owner_id: strawberry.ID, name: str, species: str, chip_id: str | None) -> Pet:
    """Постановка питомца на учёт."""
    return await svc.register(str(owner_id), name, species, chip_id)


async def record_vaccination(pet_id: strawberry.ID, vaccine_code: str, done_at: str) -> Vaccination:
    """Запись факта вакцинации."""
    return await svc.record_vaccination(str(pet_id), vaccine_code, done_at)


async def transfer(pet_id: strawberry.ID, new_owner_id: strawberry.ID) -> Pet:
    """Передача питомца другому владельцу."""
    return await svc.transfer(str(pet_id), str(new_owner_id))
