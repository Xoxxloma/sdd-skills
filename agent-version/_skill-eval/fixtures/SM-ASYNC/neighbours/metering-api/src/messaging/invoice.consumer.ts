import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { AccountsService } from '../domain/accounts.service';

@Controller()
export class InvoiceConsumer {
  constructor(private readonly accounts: AccountsService) {}

  /**
   * Начисление выставлено биллингом — кладём его в историю счёта.
   * Группа и режим коммита — в config/app.yaml (consumers.invoices).
   * Коммит offset ручной и происходит ПОСЛЕ записи в базу, поэтому падение обработчика
   * приводит к повторной доставке.
   * Повтор безопасен: запись идёт upsert'ом по invoiceId.
   */
  @EventPattern('billing.invoice.issued')
  async onInvoice(@Payload() msg: InvoicePayload, @Ctx() ctx: KafkaContext) {
    await this.accounts.upsertInvoice(msg.invoiceId, msg.accountId, msg.amount);
    await ctx.getConsumer().commitOffsets([
      { topic: ctx.getTopic(), partition: ctx.getPartition(), offset: ctx.getMessage().offset },
    ]);
  }
}

interface InvoicePayload {
  invoiceId: string;
  accountId: string;
  amount: number;
  issuedAt: string;
}
