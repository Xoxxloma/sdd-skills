"""Потребление событий CRM."""
from ..domain import repository
from .events import OwnerMerged

QUEUE = "vetcare.crm.owner-merged"


async def on_owner_merged(message) -> None:
    """Слияние владельцев в CRM: переносим питомцев на выжившего владельца.

    Из тела читаются только winner_owner_id и loser_owner_id; merged_at и source_system
    игнорируются. Повтор безопасен: перенос идемпотентен по паре владельцев — питомцы,
    уже переехавшие, вторым проходом не трогаются.
    """
    event = OwnerMerged(**message.body)
    await repository.move_pets(event.loser_owner_id, event.winner_owner_id)
    # ack ставится ВРУЧНУЮ и только после записи в базу (auto_ack: false в config/app.yaml):
    # падение до записи вернёт сообщение в очередь.
    await message.ack()
