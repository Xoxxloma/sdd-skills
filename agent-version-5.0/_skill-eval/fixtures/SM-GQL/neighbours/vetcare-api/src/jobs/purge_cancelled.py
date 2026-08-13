"""Чистка отменённых приёмов. Расписание и границы прогона — в config/app.yaml."""
from ..domain import repository

NAME = "purgeCancelledAppointments"


async def run(cfg) -> None:
    """Удаляет отменённые приёмы старше retention_days.

    Берёт пачками по batch_size, за один прогон проходит не больше одной пачки:
    остаток ждёт следующей ночи. Пропущенный прогон НЕ догоняется — накопившееся
    просто уйдёт следующими прогонами.

    Событий не публикует и статусов не меняет: удаляет строки насовсем.
    Живые и завершённые приёмы не трогает ни при каких условиях.
    """
    await repository.delete_cancelled_older_than(
        days=cfg["retention_days"], limit=cfg["batch_size"]
    )
