import { useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';

import { PETS, VACCINATION_CARD } from '../api/operations';

/** Карточка питомца: данные и карта прививок. */
export function PetPage() {
  const { id } = useParams();
  const { data: pets } = useQuery(PETS, { variables: { ownerId: currentOwnerId() } });
  const { data: card } = useQuery(VACCINATION_CARD, { variables: { petId: id } });
  return <PetCard pet={pets?.pets?.find((p) => p.id === id)} vaccinations={card?.vaccinationCard} />;
}
