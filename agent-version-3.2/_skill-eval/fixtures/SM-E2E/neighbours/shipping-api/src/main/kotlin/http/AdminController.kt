@GetMapping("/api/admin/users")
@PostMapping("/api/admin/users/{id}/block")
@PostMapping("/api/admin/reindex")                 // 409 — переиндексация уже идёт

// - `block`: блокировка пользователя не отменяет его отправлений, они остаются в работе диспетчера.
