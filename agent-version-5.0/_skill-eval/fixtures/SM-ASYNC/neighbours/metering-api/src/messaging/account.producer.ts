import { Injectable } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { config } from '../config';
import { AccountClosedEvent } from './dto/events';

@Injectable()
export class AccountProducer {
  constructor(private readonly kafka: Kafka) {}

  /**
   * Лицевой счёт закрыт.
   * Событие шлётся один раз: закрытие уже закрытого счёта возвращает 409 и события не даёт.
   */
  async closed(e: AccountClosedEvent) {
    const producer = this.kafka.producer();
    await producer.send({
      topic: config.kafka.producers.accountClosed.topic,
      messages: [{ key: e.accountId, value: JSON.stringify(e) }],
    });
  }
}
