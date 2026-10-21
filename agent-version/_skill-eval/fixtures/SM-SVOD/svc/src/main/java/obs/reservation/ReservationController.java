package obs.reservation;

public class ReservationController {
    @PreAuthorize("hasRole('NIGHT_OPERATOR')")
    @PostMapping("/api/reservations/cancel")
    public void cancel() {}

    @PostMapping("/api/reservations/confirm")
    public void confirm() {}
}
