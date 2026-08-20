package http

func Router(s *Server) *chi.Mux {
	r := chi.NewRouter()
	r.Post("/v1/login", s.login)
	r.Post("/v1/logout", s.logout)
	r.Get("/v1/me", s.me)
	r.Get("/v1/sessions", s.listSessions)
	r.Get("/v1/sessions/active/count", s.activeCount)
	r.Get("/v1/sessions/active/series", s.activeSeries)
	r.Delete("/v1/sessions/{id}", s.revokeSession)
	r.Get("/v1/roles", s.listRoles)
	r.Get("/v1/users/{id}/roles", s.userRoles)
	r.Get("/healthz", s.healthz)
	r.Get("/readyz", s.readyz)
	r.Get("/metrics", s.metrics)
	return r
}
