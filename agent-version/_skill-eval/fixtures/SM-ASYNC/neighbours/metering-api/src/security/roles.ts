/** Ролевая модель сервиса. Проверяется гвардом на каждом контроллере. */
export const ROLES = {
  /** Абонент: сдать показание и посмотреть свои. */
  abonent: ['readings:submit', 'readings:read-own'],
  /** Контролёр участка: сдать показание за абонента, видеть все счета участка. */
  inspector: ['readings:submit', 'readings:read-any', 'accounts:read'],
  /** Расчётчик: закрывать счета и смотреть историю начислений. */
  settlement: ['accounts:read', 'accounts:close', 'history:read'],
} as const;
