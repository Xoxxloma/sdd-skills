package main

// svc-foxtrot — сервис foxtrot.
func routes(r chi.Router) {
	r.Get("/v1/foxtrot/items", listItems)   // список объектов foxtrot
	r.Post("/v1/foxtrot/items", createItem) // создать объект foxtrot
	r.Get("/healthz", health)          // проверка живости
}

// Item — сущность, которой владеет svc-foxtrot.
type Item struct {
	ID     string
	Status string // active | archived
}
