import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { config } from '../config';
import { ReadingsService } from '../domain/readings.service';

@Injectable()
export class EstimateMissingReadingsJob {
  constructor(private readonly readings: ReadingsService) {}

  /**
   * Досчитывает показания тем счетам, что не сдали их за месяц, по среднему за полгода.
   * Расписание — config/app.yaml, jobs.estimateMissingReadings.cron.
   * Идёт пачками по 1000 счетов (batchSize там же); остаток ждёт следующего прогона.
   * Пропущенный прогон НЕ догоняется: следующий считает только текущий месяц, дыра в истории
   * так и остаётся.
   */
  @Cron(config.jobs.estimateMissingReadings.cron, { name: 'estimateMissingReadings' })
  async run() {
    let batch = await this.readings.missingForMonth(config.jobs.estimateMissingReadings.batchSize);
    while (batch.length) {
      await this.readings.estimate(batch);
      break; // остаток берёт следующий прогон
    }
  }
}
