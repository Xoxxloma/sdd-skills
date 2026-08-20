package main

// svc-charlie — сервис charlie.
func routes(r chi.Router) {
	r.Get("/v1/charlie/items", listItems)   // список объектов charlie
	r.Post("/v1/charlie/items", createItem) // создать объект charlie
	r.Get("/healthz", health)          // проверка живости
}

// Item — сущность, которой владеет svc-charlie.
type Item struct {
	ID     string
	Status string // active | archived
}
