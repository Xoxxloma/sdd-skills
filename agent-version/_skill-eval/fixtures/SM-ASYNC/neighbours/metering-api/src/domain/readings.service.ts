import { Injectable } from '@nestjs/common';
import { ReadingProducer } from '../messaging/reading.producer';

@Injectable()
export class ReadingsService {
  constructor(private readonly events: ReadingProducer) {}

  /** Выдача не включает досчитанные задачей показания: origin = 'submitted'. */
  async list(accountId: string, from: string) {
    return this.db.query(
      `select * from readings where account_id = $1 and taken_at >= $2 and origin = 'submitted'`,
      [accountId, from],
    );
  }

  async byId(id: string) {
    return this.db.one(`select * from readings where id = $1`, [id]);
  }

  /**
   * Приём показания. Валидация решает, какое из двух событий уйдёт.
   * Повторное показание за тот же расчётный период отклоняется с reason = 'duplicate'
   * и кодом 409.
   */
  async submit(dto: { accountId: string; value: number; takenAt: string; source: string }) {
    const reason = await this.validate(dto);
    if (reason) {
      await this.events.rejected({ accountId: dto.accountId, value: dto.value, reason });
      return { accepted: false, reason };
    }
    await this.save(dto);
    await this.events.accepted(dto as never);
    return { accepted: true };
  }

  private db!: { query: Function; one: Function };
  private async validate(_dto: unknown): Promise<'out_of_range' | 'duplicate' | 'meter_sealed' | null> {
    return null;
  }
  private async save(_dto: unknown) {}
  async missingForMonth(_limit: number): Promise<unknown[]> {
    return [];
  }
  async estimate(_batch: unknown[]) {}
}
