import { Injectable } from '@nestjs/common';
import { Kafka } from 'kafkajs';

@Injectable()
export class InvoiceProducer {
  constructor(private readonly kafka: Kafka) {}

  /**
   * Начисление выставлено. Ключ партиции — accountId.
   * Шлётся после коммита транзакции начисления; при ретрае возможен дубль,
   * потребитель обязан быть идемпотентным по invoiceId.
   */
  async issued(e: { invoiceId: string; accountId: string; amount: number; issuedAt: string }) {
    const producer = this.kafka.producer();
    await producer.send({
      topic: 'billing.invoice.issued',
      messages: [{ key: e.accountId, value: JSON.stringify(e) }],
    });
  }
}
