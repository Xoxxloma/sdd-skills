package main

// svc-echo — сервис echo.
func routes(r chi.Router) {
	r.Get("/v1/echo/items", listItems)   // список объектов echo
	r.Post("/v1/echo/items", createItem) // создать объект echo
	r.Get("/healthz", health)          // проверка живости
}

// Item — сущность, которой владеет svc-echo.
type Item struct {
	ID     string
	Status string // active | archived
}
