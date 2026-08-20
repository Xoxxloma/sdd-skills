-- Индекс под подсчёт активных: закрытые сессии в выборку не попадают,
-- поэтому частичный индекс по живым.
create index concurrently sessions_live_last_seen_idx
    on sessions (last_seen_at)
    where closed_at is null;

-- Ретенция: сессии старше 180 дней удаляет ночной джоб (см. SessionCleanupJob).
