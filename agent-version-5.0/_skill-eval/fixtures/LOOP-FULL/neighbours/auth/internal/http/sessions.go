package http

// Счётчик живых сессий. Считает по last_seen_at, а не по created_at:
// вкладка, открытая утром и заброшенная, активной не считается.
func (s *Server) activeCount(w http.ResponseWriter, r *http.Request) {
	n, err := s.store.CountActive(r.Context(), s.window)
	if err != nil {
		// источник недоступен — отдаём 200 с флагом, а не 5xx:
		// потребители рисуют своё состояние и не считают это ошибкой запроса
		writeJSON(w, 200, activeCountResponse{Count: nil, SourceAvailable: false})
		return
	}
	writeJSON(w, 200, activeCountResponse{Count: &n, SourceAvailable: true})
}

func (s *Server) activeSeries(w http.ResponseWriter, r *http.Request) {
	g, err := parseGranularity(r.URL.Query().Get("granularity")) // hour | day | week
	if err != nil {
		writeErr(w, 400, "bad_granularity")
		return
	}
	points, err := s.store.ActiveSeries(r.Context(), parsePeriod(r), g)
	if err != nil {
		writeJSON(w, 200, seriesResponse{Points: nil, SourceAvailable: false})
		return
	}
	writeJSON(w, 200, seriesResponse{Points: points, SourceAvailable: true})
}
