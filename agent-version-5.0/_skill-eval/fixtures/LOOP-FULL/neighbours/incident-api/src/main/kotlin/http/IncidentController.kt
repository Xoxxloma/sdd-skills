@RestController
class IncidentController(private val incidents: IncidentService) {
    @GetMapping("/v1/incidents") fun list(@RequestParam f: IncidentFilter): IncidentPageDto = incidents.list(f)
    @PostMapping("/v1/incidents") fun create(@RequestBody b: CreateIncidentRequest): IncidentDto = incidents.create(b)
    @GetMapping("/v1/incidents/{id}") fun get(@PathVariable id: String): IncidentDto = incidents.get(id)
    @PostMapping("/v1/incidents/{id}/close") fun close(@PathVariable id: String): IncidentDto = incidents.close(id)
    @GetMapping("/v1/incidents/export") fun export(@RequestParam p: PeriodParam): ByteArray = incidents.export(p)
}
