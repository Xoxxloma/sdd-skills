data class SiteDto(
    val id: String,
    val name: String,
    val addressRaw: String,
    val addressNormalized: String?,
    val guardType: GuardType,
    val activeIncidents: Int,
)
data class SitePageDto(val items: List<SiteDto>, val total: Int)
enum class GuardType { PHYSICAL, TECHNICAL, MIXED }
