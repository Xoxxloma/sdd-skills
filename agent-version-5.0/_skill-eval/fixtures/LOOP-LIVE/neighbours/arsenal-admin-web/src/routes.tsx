import { createBrowserRouter } from 'react-router-dom'
import { IncidentsPage } from './pages/IncidentsPage'
import { IncidentPage } from './pages/IncidentPage'
import { SettingsPage } from './pages/SettingsPage'

export const router = createBrowserRouter([
  { path: '/incidents', element: <IncidentsPage /> },
  { path: '/incidents/:id', element: <IncidentPage /> },
  { path: '/settings', element: <SettingsPage /> },
])
