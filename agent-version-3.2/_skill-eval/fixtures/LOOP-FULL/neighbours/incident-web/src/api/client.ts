export const api = {
  sites: () => get("/v1/sites"),
  site: (id: string) => get(`/v1/sites/${id}`),
  siteIncidents: (id: string) => get(`/v1/sites/${id}/incidents`),
  incidents: () => get("/v1/incidents"),
  closeIncident: (id: string) => post(`/v1/incidents/${id}/close`),
  exportIncidents: (p: Period) => get("/v1/incidents/export", p),
}
