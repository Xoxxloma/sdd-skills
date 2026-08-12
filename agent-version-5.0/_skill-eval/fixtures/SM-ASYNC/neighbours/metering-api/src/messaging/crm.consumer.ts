import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AccountsService } from '../domain/accounts.service';

@Controller()
export class CrmConsumer {
  constructor(private readonly accounts: AccountsService) {}

  /**
   * Абонента переименовали в CRM.
   * Из тела берутся только accountId и name — остальные поля CRM игнорируются намеренно:
   * адрес и телефон у нас свои и перетирать их нельзя.
   * Ошибка обработки повторяется 3 раза (см. retries в config/app.yaml), после чего сообщение
   * отбрасывается: отдельного DLQ-топика у этого консьюмера нет.
   */
  @EventPattern('crm.account.renamed')
  async onRenamed(@Payload() msg: Record<string, unknown>) {
    await this.accounts.rename(String(msg.accountId), String(msg.name));
  }
}
