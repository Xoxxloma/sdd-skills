package obs.reservation;

@Entity
public class Reservation {
    private Long id;
    private ReservationStatus status = ReservationStatus.REQUESTED;
    private Priority priority;
}
