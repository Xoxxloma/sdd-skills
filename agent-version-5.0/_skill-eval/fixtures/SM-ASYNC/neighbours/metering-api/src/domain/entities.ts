/** Сущности metering-api. Сервис — единственный владелец всех трёх. */

export interface Account {
  id: string;
  number: string;
  name: string;
  /** `closed` ставит задача closeStaleAccounts или закрытие через API; сам абонент — нет. */
  status: 'active' | 'suspended' | 'closed';
  closedAt: string | null;
}

export interface Reading {
  id: string;
  accountId: string;
  value: number;
  takenAt: string;
  /** `estimated` — показание досчитано задачей, а не сдано абонентом. */
  origin: 'submitted' | 'estimated';
}

export interface Meter {
  id: string;
  accountId: string;
  model: string;
  /** Дата поверки. `null` у приборов, снятых с учёта, — не значит «поверка просрочена». */
  verifiedAt: string | null;
  discontinued: boolean;
}
