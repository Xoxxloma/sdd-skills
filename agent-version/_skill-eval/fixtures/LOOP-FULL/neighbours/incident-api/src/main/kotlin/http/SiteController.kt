@RestController
class SiteController(private val sites: SiteService) {
    @GetMapping("/v1/sites") fun list(@RequestParam f: SiteFilter): SitePageDto = sites.list(f)
    @PostMapping("/v1/sites") fun create(@RequestBody b: CreateSiteRequest): SiteDto = sites.create(b)
    @GetMapping("/v1/sites/{id}") fun get(@PathVariable id: String): SiteDto = sites.get(id)
    @PatchMapping("/v1/sites/{id}") fun patch(@PathVariable id: String, @RequestBody b: PatchSiteRequest): SiteDto = sites.patch(id, b)
    @GetMapping("/v1/sites/{id}/incidents") fun incidents(@PathVariable id: String): List<IncidentDto> = sites.incidents(id)
}
