package main

// svc-bravo — сервис bravo.
func routes(r chi.Router) {
	r.Get("/v1/bravo/items", listItems)   // список объектов bravo
	r.Post("/v1/bravo/items", createItem) // создать объект bravo
	r.Get("/healthz", health)          // проверка живости
}

// Item — сущность, которой владеет svc-bravo.
type Item struct {
	ID     string
	Status string // active | archived
}
