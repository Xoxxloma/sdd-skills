package ru.arsenal.domain

import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.CrudRepository
import java.time.Instant

interface SessionRepository : CrudRepository<Session, String> {

    /**
     * Активной считается сессия, у которой не проставлен closedAt И последняя активность
     * была не позже пятнадцати минут назад. Порог зашит здесь и нигде больше не настраивается.
     */
    @Query(
        """
        select count(s) from Session s
        where s.closedAt is null
          and s.lastSeenAt > :since
        """
    )
    fun countActive(since: Instant): Long

    fun forCurrentUser(): List<ru.arsenal.dto.SessionDto>

    fun revoke(id: String)
}
