export const routes = [
  { path: "/", element: <Dashboard /> },
  { path: "/sites", element: <SiteList /> },
  { path: "/sites/:id", element: <SiteCard /> },
  { path: "/incidents", element: <IncidentList /> },
  { path: "/incidents/:id", element: <IncidentCard /> },
  { path: "/reports", element: <Reports /> },
  { path: "/admin/users", element: <UserAdmin /> },
]
