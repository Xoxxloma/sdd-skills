package store

// Окно активности — 15 минут: сессия живая, если last_seen_at свежее.
const ActiveWindow = 15 * time.Minute

func (s *Store) CountActive(ctx context.Context, window time.Duration) (int, error) {
	// revoked не считаем даже внутри окна
	return s.q.CountSessions(ctx, `last_seen_at > $1 AND revoked_at IS NULL`, time.Now().Add(-window))
}
