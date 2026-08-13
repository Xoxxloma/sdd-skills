-- Схема сервиса. Все четыре таблицы заводятся здесь и живут только в этой базе.
CREATE TABLE clinics (
  id      uuid PRIMARY KEY,
  name    text NOT NULL,
  address text NOT NULL
);

CREATE TABLE pets (
  id          uuid PRIMARY KEY,
  owner_id    uuid NOT NULL,
  name        text NOT NULL,
  species     text NOT NULL,
  chip_id     text,
  weight_kg   numeric,
  archived_at timestamptz
);

CREATE TABLE appointments (
  id            uuid PRIMARY KEY,
  pet_id        uuid NOT NULL REFERENCES pets (id),
  clinic_id     uuid NOT NULL REFERENCES clinics (id),
  vet_id        uuid NOT NULL,
  slot_at       timestamptz NOT NULL,
  status        text NOT NULL,
  cancel_reason text
);

CREATE TABLE vaccinations (
  id           uuid PRIMARY KEY,
  pet_id       uuid NOT NULL REFERENCES pets (id),
  vaccine_code text NOT NULL,
  done_at      timestamptz NOT NULL,
  next_due_at  timestamptz
);
