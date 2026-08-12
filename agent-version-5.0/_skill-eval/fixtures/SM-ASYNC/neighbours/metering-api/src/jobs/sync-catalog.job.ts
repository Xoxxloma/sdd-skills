import { Injectable } from '@nestjs/common';
import { MetersService } from '../domain/meters.service';

@Injectable()
export class SyncMeterCatalogJob {
  constructor(private readonly meters: MetersService) {}

  /**
   * Синхронизирует справочник моделей приборов учёта с реестром производителя.
   * Аннотации расписания у задачи НЕТ: её дёргает внешний планировщик по HTTP-хуку
   * инфраструктуры, и его манифест лежит в другом репозитории. Здесь только тело.
   * Модель, исчезнувшая из реестра, из справочника не удаляется — помечается
   * discontinued, потому что на неё ссылаются старые приборы.
   */
  async run() {
    const remote = await this.meters.fetchRegistry();
    await this.meters.upsertAll(remote);
    await this.meters.markDiscontinuedMissing(remote);
  }
}
