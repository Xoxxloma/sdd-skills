@GetMapping("/api/carriers")                       // заблокированные остаются в выдаче
@PostMapping("/api/carriers")
@GetMapping("/api/carriers/{id}")
@PatchMapping("/api/carriers/{id}")
@GetMapping("/api/carriers/{id}/vehicles")
@PostMapping("/api/carriers/{id}/vehicles")

// - `carriers list`: заблокированные перевозчики из выдачи не исчезают, приходят с `blocked: true`.
// - `carriers POST`: ИНН проверяется на уникальность; повтор даёт `409`, а не второго перевозчика.
