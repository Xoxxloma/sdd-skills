import { useQuery } from '@apollo/client';

import { CLINICS } from '../api/operations';
import { useFilters } from '../store/filters';

/** Справочник клиник: выбрать клинику, дальше расписание показывает её. */
export function ClinicsPage() {
  const { data } = useQuery(CLINICS);
  const { setClinic } = useFilters();
  return <ClinicList items={data?.clinics ?? []} onPick={setClinic} />;
}
