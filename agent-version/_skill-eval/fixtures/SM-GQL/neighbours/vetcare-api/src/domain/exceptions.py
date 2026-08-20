"""Доменные исключения. Их коды для клиента — в api/errors.py."""


class SlotTaken(Exception):
    """Слот врача занят другим приёмом."""


class CancelWindowPassed(Exception):
    """Отмена позже разрешённого окна."""


class ChipAlreadyUsed(Exception):
    """Чип зарегистрирован на другого питомца."""


class PetArchived(Exception):
    """Питомец снят с учёта."""
