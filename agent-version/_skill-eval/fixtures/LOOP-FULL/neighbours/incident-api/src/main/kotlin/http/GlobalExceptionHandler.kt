@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(IncidentAlreadyClosedException::class)
    fun onClosed(e: Exception) = ResponseEntity.status(409).body(ErrorBody("incident_already_closed"))
    @ExceptionHandler(SiteNotFoundException::class)
    fun onNoSite(e: Exception) = ResponseEntity.status(404).body(ErrorBody("site_not_found"))
    @ExceptionHandler(PeriodTooLongException::class)
    fun onPeriod(e: Exception) = ResponseEntity.status(400).body(ErrorBody("period_too_long"))
}
