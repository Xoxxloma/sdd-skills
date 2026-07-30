package main

// svc-alpha — сервис alpha.
func routes(r chi.Router) {
	r.Get("/v1/alpha/items", listItems)   // список объектов alpha
	r.Post("/v1/alpha/items", createItem) // создать объект alpha
	r.Get("/healthz", health)          // проверка живости
}

// Item — сущность, которой владеет svc-alpha.
type Item struct {
	ID     string
	Status string // active | archived
}
