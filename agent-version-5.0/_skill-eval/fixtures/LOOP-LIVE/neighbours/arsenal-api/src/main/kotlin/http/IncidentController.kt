package ru.arsenal.http

import org.springframework.web.bind.annotation.*
import ru.arsenal.domain.IncidentRepository
import ru.arsenal.dto.IncidentDto
import ru.arsenal.dto.PageDto

@RestController
@RequestMapping("/v1/incidents")
class IncidentController(private val repo: IncidentRepository) {

    @GetMapping
    fun list(
        @RequestParam(required = false) status: String?,
        @RequestParam(defaultValue = "0") page: Int,
    ): PageDto<IncidentDto> = repo.page(status, page)

    @GetMapping("/{id}")
    fun byId(@PathVariable id: String): IncidentDto = repo.byId(id)

    @PostMapping("/{id}/close")
    fun close(@PathVariable id: String, @RequestBody body: CloseRequest): IncidentDto =
        repo.close(id, body.reason)
}

data class CloseRequest(val reason: String)
