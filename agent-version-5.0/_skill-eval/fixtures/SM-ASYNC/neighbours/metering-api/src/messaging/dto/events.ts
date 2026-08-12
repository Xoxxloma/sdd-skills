/** Тела событий, которые сервис публикует. Читаются потребителями как контракт. */

export interface ReadingAcceptedEvent {
  accountId: string;
  value: number;
  takenAt: string;
  source: 'abonent' | 'device' | 'inspector';
}

export interface ReadingRejectedEvent {
  accountId: string;
  value: number;
  /** Почему показание не принято. Других значений не бывает. */
  reason: 'out_of_range' | 'duplicate' | 'meter_sealed';
}

export interface AccountClosedEvent {
  accountId: string;
  closedAt: string;
}
