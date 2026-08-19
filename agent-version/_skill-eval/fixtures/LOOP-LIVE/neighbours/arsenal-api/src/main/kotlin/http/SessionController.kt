package ru.arsenal.http

import org.springframework.web.bind.annotation.*
import ru.arsenal.domain.SessionRepository
import ru.arsenal.dto.SessionDto

@RestController
@RequestMapping("/v1/sessions")
class SessionController(private val repo: SessionRepository) {

    /** Список сессий текущего пользователя. Чужие сессии не отдаются никогда. */
    @GetMapping("/my")
    fun my(): List<SessionDto> = repo.forCurrentUser()

    /** Завершить свою сессию. Идемпотентен: повторный вызов на закрытой отдаёт 204. */
    @DeleteMapping("/{id}")
    fun revoke(@PathVariable id: String) = repo.revoke(id)
}
