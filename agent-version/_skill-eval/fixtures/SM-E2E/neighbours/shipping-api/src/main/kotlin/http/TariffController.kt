@GetMapping("/api/tariffs")
@PostMapping("/api/tariffs")
@GetMapping("/api/tariffs/{id}")
@PutMapping("/api/tariffs/{id}")
@PostMapping("/api/tariffs/calculate")

// - `calculate`: расчёт идёт по тарифу, действовавшему на дату отправки, а не на дату запроса.
// - `PUT /api/tariffs/{id}`: перезаписывает тариф целиком, частичное обновление не поддерживается.
