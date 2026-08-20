-- Один чип — один питомец. Индекс частичный: питомцев без чипа может быть сколько угодно.
CREATE UNIQUE INDEX uq_pets_chip_id ON pets (chip_id) WHERE chip_id IS NOT NULL;

-- Ключ идемпотентности записи на приём живёт сутки, дальше чистится джобой.
ALTER TABLE appointments ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX uq_appointments_idem ON appointments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
