// Роуты svc-golf
export const routes = [
  { path: "/golf", element: <ListPage /> },       // список golf
  { path: "/golf/:id", element: <DetailPage /> }, // карточка golf
]
// api-клиент: GET /v1/golf/items у svc-alpha
