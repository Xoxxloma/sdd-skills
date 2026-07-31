// Карточка объекта охраны. Блок «Оборудование» здесь пока не рендерится —
// раздел добавляется отдельной задачей.
export function SiteCard({ id }: { id: string }) {
  const { data, error, isLoading } = useSite(id)
  if (isLoading) return <Skeleton />
  if (error) return <ErrorState onRetry={refetch} />
  if (!data) return <EmptyState text="—" />
  return <SiteView site={data} />
}
