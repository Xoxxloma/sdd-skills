import { useMutation, useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';

import { APPOINTMENT, BOOK_APPOINTMENT, CANCEL_APPOINTMENT } from '../api/operations';

/** Карточка приёма: перенести, отменить, записать заново. */
export function AppointmentPage() {
  const { id } = useParams();
  const { data } = useQuery(APPOINTMENT, { variables: { id } });
  const [book] = useMutation(BOOK_APPOINTMENT);
  const [cancel] = useMutation(CANCEL_APPOINTMENT);

  const rebook = (petId: string, slotAt: string, vetId: string) =>
    book({ variables: { petId, slotAt, vetId, idempotencyKey: uuid() } });

  return <AppointmentCard item={data?.appointment} onCancel={cancel} onRebook={rebook} />;
}
