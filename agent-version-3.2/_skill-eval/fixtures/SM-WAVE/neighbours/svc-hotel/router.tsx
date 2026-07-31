// Роуты svc-hotel
export const routes = [
  { path: "/hotel", element: <ListPage /> },       // список hotel
  { path: "/hotel/:id", element: <DetailPage /> }, // карточка hotel
]
// api-клиент: GET /v1/hotel/items у svc-alpha
