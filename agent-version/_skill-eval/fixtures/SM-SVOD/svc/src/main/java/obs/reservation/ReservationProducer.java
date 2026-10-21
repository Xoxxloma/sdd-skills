package obs.reservation;

public class ReservationProducer {
    public void publishCancelled(Reservation r) {
        kafka.send(cancelledTopic, r);
    }
}
