import { gql } from '@apollo/client';

// Все обращения к vetcare-api идут одним транспортом POST /graphql;
// различает их имя операции.

export const APPOINTMENTS = gql`
  query appointments($clinicId: ID!, $from: String!, $to: String!) {
    appointments(clinicId: $clinicId, dateFrom: $from, dateTo: $to) {
      id
      slotAt
      status
      pet { id name }
    }
  }
`;

export const APPOINTMENT = gql`
  query appointment($id: ID!) {
    appointment(id: $id) {
      id
      slotAt
      status
      cancelReason
    }
  }
`;

export const PETS = gql`
  query pets($ownerId: ID!) {
    pets(ownerId: $ownerId) {
      id
      name
      species
      weightKg
    }
  }
`;

export const VACCINATION_CARD = gql`
  query vaccinationCard($petId: ID!) {
    vaccinationCard(petId: $petId) {
      id
      vaccineCode
      doneAt
      nextDueAt
    }
  }
`;

export const CLINICS = gql`
  query clinics {
    clinics {
      id
      name
      address
    }
  }
`;

// Ключ идемпотентности генерится на клиенте (uuid v4) и переживает ретрай сети:
// повторная отправка той же формы не заводит второй приём.
export const BOOK_APPOINTMENT = gql`
  mutation bookAppointment($petId: ID!, $slotAt: String!, $vetId: ID!, $idempotencyKey: String!) {
    bookAppointment(petId: $petId, slotAt: $slotAt, vetId: $vetId, idempotencyKey: $idempotencyKey) {
      id
      status
    }
  }
`;

export const CANCEL_APPOINTMENT = gql`
  mutation cancelAppointment($id: ID!, $reason: String!) {
    cancelAppointment(id: $id, reason: $reason) {
      id
      status
    }
  }
`;

export const APPOINTMENT_STATUS_CHANGED = gql`
  subscription appointmentStatusChanged {
    appointmentStatusChanged {
      id
      status
    }
  }
`;
