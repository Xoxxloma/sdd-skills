"""Сборка схемы. Здесь объявлены все операции сервиса; тела резолверов — в соседних модулях.

Транспорт один: FastAPI монтирует эту схему на POST /graphql (см. config/app.yaml).
"""
import strawberry

from . import appointments, clinics, pets


@strawberry.type
class Query:
    appointments = strawberry.field(resolver=appointments.appointments)
    appointment = strawberry.field(resolver=appointments.appointment)
    pets = strawberry.field(resolver=pets.pets)
    vaccination_card = strawberry.field(name="vaccinationCard", resolver=pets.vaccination_card)
    clinics = strawberry.field(resolver=clinics.clinics)


@strawberry.type
class Mutation:
    book_appointment = strawberry.mutation(name="bookAppointment", resolver=appointments.book)
    cancel_appointment = strawberry.mutation(name="cancelAppointment", resolver=appointments.cancel)
    register_pet = strawberry.mutation(name="registerPet", resolver=pets.register)
    record_vaccination = strawberry.mutation(name="recordVaccination", resolver=pets.record_vaccination)
    transfer_pet = strawberry.mutation(name="transferPet", resolver=pets.transfer)


@strawberry.type
class Subscription:
    appointment_status_changed = strawberry.subscription(
        name="appointmentStatusChanged", resolver=clinics.appointment_status_changed
    )


schema = strawberry.Schema(query=Query, mutation=Mutation, subscription=Subscription)
