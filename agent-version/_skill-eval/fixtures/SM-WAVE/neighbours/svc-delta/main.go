package main

// svc-delta — сервис delta.
func routes(r chi.Router) {
	r.Get("/v1/delta/items", listItems)   // список объектов delta
	r.Post("/v1/delta/items", createItem) // создать объект delta
	r.Get("/healthz", health)          // проверка живости
}

// Item — сущность, которой владеет svc-delta.
type Item struct {
	ID     string
	Status string // active | archived
}
