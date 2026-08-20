import { Injectable } from '@nestjs/common';
import { InvoiceProducer } from './messaging/invoice.producer';

@Injectable()
export class ChargeService {
  constructor(private readonly events: InvoiceProducer) {}

  /** Начисление по показанию. Идемпотентно по (accountId, takenAt). */
  async accrue(accountId: string, value: number, takenAt: string) {
    const invoiceId = `${accountId}:${takenAt}`;
    await this.events.issued({ invoiceId, accountId, amount: value * 4.7, issuedAt: takenAt });
  }

  async finalize(_accountId: string, _closedAt: string) {}
}
