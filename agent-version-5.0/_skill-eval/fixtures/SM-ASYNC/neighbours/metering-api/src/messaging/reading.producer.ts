import { Injectable } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { config } from '../config';
import { ReadingAcceptedEvent, ReadingRejectedEvent } from './dto/events';

@Injectable()
export class ReadingProducer {
  constructor(private readonly kafka: Kafka) {}

  /**
   * Показание принято.
   * Публикуется ТОЛЬКО после того, как транзакция сохранения зафиксирована:
   * вызов стоит после commit, отдельным шагом, поэтому при ретрае отправки
   * потребитель может получить дубль.
   */
  async accepted(e: ReadingAcceptedEvent) {
    await this.send(config.kafka.producers.readingAccepted.topic, e.accountId, e);
  }

  /**
   * Показание отклонено валидацией.
   * Отклонённое показание в базу не пишется, поэтому пары к нему в `metering.reading.accepted`
   * не будет никогда.
   */
  async rejected(e: ReadingRejectedEvent) {
    await this.send(config.kafka.producers.readingRejected.topic, e.accountId, e);
  }

  // Ключ партиции — accountId (см. config/app.yaml, partitionKey): порядок событий
  // гарантирован в пределах лицевого счёта, между счетами — нет.
  private async send(topic: string, key: string, value: unknown) {
    const producer = this.kafka.producer();
    await producer.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
  }
}
