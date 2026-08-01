package ru.arsenal.domain

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "sessions")
class Session(
    @Id val id: String,

    @Column(name = "user_id", nullable = false)
    val userId: String,

    @Column(name = "started_at", nullable = false)
    val startedAt: Instant,

    /** Обновляется на каждом запросе пользователя. По нему считается «активность». */
    @Column(name = "last_seen_at", nullable = false)
    var lastSeenAt: Instant,

    /**
     * Проставляется при выходе или при чистке ночным джобом.
     * null означает «сессия ещё живая», а не «данных нет».
     */
    @Column(name = "closed_at")
    var closedAt: Instant? = null,
)
