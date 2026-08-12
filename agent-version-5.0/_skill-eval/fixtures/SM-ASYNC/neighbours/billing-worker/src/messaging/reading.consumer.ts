import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ChargeService } from '../charge.service';

@Controller()
export class ReadingConsumer {
  constructor(private readonly charge: ChargeService) {}

  /**
   * Принятое показание — повод начислить. Группа billing-metering, автокоммит выключен.
   * Повтор безопасен: начисление идемпотентно по паре (accountId, takenAt).
   */
  @EventPattern('metering.reading.accepted')
  async onReading(@Payload() msg: { accountId: string; value: number; takenAt: string }) {
    await this.charge.accrue(msg.accountId, msg.value, msg.takenAt);
  }

  /**
   * Счёт закрыт — доначисляем остаток и больше по нему не начисляем.
   */
  @EventPattern('metering.account.closed')
  async onClosed(@Payload() msg: { accountId: string; closedAt: string }) {
    await this.charge.finalize(msg.accountId, msg.closedAt);
  }
}
