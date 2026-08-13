import { useQuery, useSubscription } from '@apollo/client';

import { APPOINTMENTS, APPOINTMENT_STATUS_CHANGED } from '../api/operations';
import { useFilters } from '../store/filters';

/** Расписание клиники на период: врач и регистратура фильтруют и открывают приём. */
export function AppointmentsPage() {
  const { clinicId } = useFilters();
  const { data } = useQuery(APPOINTMENTS, { variables: { clinicId, from: today(), to: plus7() } });
  // Статусы приходят потоком и правят список на месте, без перезапроса.
  useSubscription(APPOINTMENT_STATUS_CHANGED);
  return <Schedule items={data?.appointments ?? []} />;
}
