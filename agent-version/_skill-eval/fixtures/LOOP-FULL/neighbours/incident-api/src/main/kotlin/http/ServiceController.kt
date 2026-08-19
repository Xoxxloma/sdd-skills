@RestController
class ServiceController {
    @GetMapping("/healthz") fun health() = mapOf("status" to "UP")
    @GetMapping("/metrics") fun metrics() = registry.scrape()
    @GetMapping("/v1/version") fun version() = mapOf("build" to buildProperties.version)
}
