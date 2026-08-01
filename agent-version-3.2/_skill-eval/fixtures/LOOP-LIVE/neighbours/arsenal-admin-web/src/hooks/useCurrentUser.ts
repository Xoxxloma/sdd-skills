import { useQuery } from '@tanstack/react-query'

export type Role = 'ADMIN' | 'OPERATOR'

export interface CurrentUser {
  id: string
  displayName: string
  role: Role
}

/**
 * Роль приходит с бэка вместе с профилем. Скрывать элементы по роли на фронте
 * можно, но бэк всё равно проверяет доступ сам — фронтовая проверка косметическая.
 */
export function useCurrentUser() {
  const { data, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => fetch('/v1/me', { credentials: 'include' }).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })
  return { user: data as CurrentUser | undefined, isLoading }
}
