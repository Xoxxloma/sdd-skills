@Entity @Table(name = "site")
class Site(
    @Id val id: String,
    val name: String,
    val addressRaw: String,
    var addressNormalized: String?,
    @Enumerated(EnumType.STRING) val guardType: GuardType,
    @CreationTimestamp val createdAt: Instant,
)

@Entity @Table(name = "incident")
class Incident(
    @Id val id: String,
    @ManyToOne @JoinColumn(name = "site_id") val site: Site,
    @Enumerated(EnumType.STRING) var status: IncidentStatus,
    var closedAt: Instant?,
)
enum class IncidentStatus { OPEN, CONFIRMED, CLOSED }
