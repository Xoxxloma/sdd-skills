import { createBrowserRouter } from 'react-router-dom';

import { AppointmentPage } from './pages/AppointmentPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { ClinicsPage } from './pages/ClinicsPage';
import { PetPage } from './pages/PetPage';

export const router = createBrowserRouter([
  { path: '/appointments', element: <AppointmentsPage /> },
  { path: '/appointments/:id', element: <AppointmentPage /> },
  { path: '/pets/:id', element: <PetPage /> },
  { path: '/clinics', element: <ClinicsPage /> },
]);
