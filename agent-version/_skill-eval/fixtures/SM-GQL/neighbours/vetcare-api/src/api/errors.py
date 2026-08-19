"""Маппинг доменного исключения в код ошибки GraphQL (extensions.code).

HTTP-статус у GraphQL всегда 200; смысл ошибки несёт только этот код.
"""
from ..domain import exceptions as ex

ERROR_CODES = {
    # Слот у врача уже занят другим приёмом.
    ex.SlotTaken: "SLOT_TAKEN",
    # Отмена позже разрешённого окна: приём остаётся, деньги не возвращаются.
    ex.CancelWindowPassed: "TOO_LATE",
    # Чип уже зарегистрирован на другого питомца.
    ex.ChipAlreadyUsed: "CHIP_TAKEN",
    # Питомец снят с учёта: записать на него приём нельзя.
    ex.PetArchived: "PET_ARCHIVED",
}


def to_code(err: Exception) -> str:
    return ERROR_CODES.get(type(err), "INTERNAL")
