@GetMapping("/api/shipments")                      // фильтры: status, carrierId, period
@PostMapping("/api/shipments")
@GetMapping("/api/shipments/{id}")
@PatchMapping("/api/shipments/{id}")
@PostMapping("/api/shipments/{id}/dispatch")       // 409 — груз уже в пути
@PostMapping("/api/shipments/{id}/deliver")
@PostMapping("/api/shipments/{id}/cancel")         // 422 — груз уже доставлен
@GetMapping("/api/shipments/{id}/waybill")         // ТТН в PDF
@GetMapping("/api/shipments/{id}/events")
@GetMapping("/api/shipments/export")               // CSV

// - `list`: `total` не учитывает отменённые отправления, даже если фильтр по статусу их включает.
// - `get`: `assignedVehicleId: String?` — `null` означает «машина не назначена», а не «снята с рейса».
// - `cancel`: отмена в пути разрешена; `422` приходит только на уже доставленный груз.
// - `export`: `period` обязателен, максимум 62 дня.
