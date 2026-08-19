// Реестр перевозчиков — проверка лицензии перед созданием отправления.
val carrierRegistry = RestTemplate(baseUrl = env("CARRIER_REGISTRY_URL"))

// Старый биллинг: пересчёт стоимости после доставки. Мигрируем, но пока живой.
val billingLegacy = RestTemplate(baseUrl = env("BILLING_LEGACY_URL"))
