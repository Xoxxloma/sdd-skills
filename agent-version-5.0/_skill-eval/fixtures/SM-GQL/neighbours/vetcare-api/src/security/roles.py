"""Роли и права. Проверка стоит на каждой операции схемы через директиву permission."""
from dataclasses import dataclass

VET = "vet"
RECEPTIONIST = "receptionist"
OWNER = "owner"

PERMISSIONS = {
    # Врач видит приёмы своей клиники и пишет вакцинации.
    VET: {"appointments", "appointment", "vaccinationCard", "recordVaccination",
          "appointmentStatusChanged"},
    # Регистратура ведёт запись и учёт питомцев целиком.
    RECEPTIONIST: {"appointments", "appointment", "bookAppointment", "cancelAppointment",
                   "registerPet", "transferPet", "pets", "clinics", "appointmentStatusChanged"},
    # Владелец — только свои питомцы и своя запись; чужие приёмы недоступны.
    OWNER: {"pets", "vaccinationCard", "bookAppointment", "cancelAppointment", "clinics"},
}


@dataclass
class User:
    id: str
    role: str
    clinic_id: str | None  # None у владельца: он не привязан к клинике


def current_user(info) -> User:
    return info.context["user"]
