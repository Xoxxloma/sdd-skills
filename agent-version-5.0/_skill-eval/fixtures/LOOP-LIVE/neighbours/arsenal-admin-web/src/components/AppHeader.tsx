import { useCurrentUser } from '../hooks/useCurrentUser'

/**
 * Шапка админки. Сюда встраивается всё, что должно быть видно на любой странице.
 * Правая часть отдана пользовательскому меню; левая — логотипу и навигации.
 */
export function AppHeader() {
  const { user, isLoading } = useCurrentUser()

  return (
    <header className="app-header">
      <div className="app-header__left">
        <Logo />
        <MainNav />
      </div>
      <div className="app-header__right">
        {isLoading ? <UserMenuSkeleton /> : <UserMenu user={user} />}
      </div>
    </header>
  )
}
