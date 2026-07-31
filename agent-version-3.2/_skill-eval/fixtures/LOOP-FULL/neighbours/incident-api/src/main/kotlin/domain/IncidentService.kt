@Service
class IncidentService(private val repo: IncidentRepository, private val auth: AuthClient) {
    fun export(p: PeriodParam): ByteArray {
        if (ChronoUnit.DAYS.between(p.from, p.to) > MAX_EXPORT_DAYS) throw PeriodTooLongException()
        return csv(repo.inPeriod(p))
    }
    companion object { const val MAX_EXPORT_DAYS = 92L }
}
