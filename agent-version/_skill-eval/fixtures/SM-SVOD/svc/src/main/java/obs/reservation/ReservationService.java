package obs.reservation;

public class ReservationService {
    public void confirm(Reservation r) {
        r.setStatus(ReservationStatus.CONFIRMED);
    }

    public void cancel(Reservation r) {
        if (r.getStatus() == ReservationStatus.CANCELLED) {
            throw new IllegalStateException("бронь уже отменена");
        }
        r.setStatus(ReservationStatus.CANCELLED);
        producer.publishCancelled(r);
    }
}
