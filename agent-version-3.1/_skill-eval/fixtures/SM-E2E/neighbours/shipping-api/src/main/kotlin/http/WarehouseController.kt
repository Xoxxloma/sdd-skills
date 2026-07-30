@GetMapping("/api/warehouses")
@GetMapping("/api/warehouses/{id}")
@GetMapping("/api/warehouses/{id}/slots")
@PostMapping("/api/warehouses/{id}/slots")

// - `slots POST`: идемпотентен по паре «склад + временное окно».
