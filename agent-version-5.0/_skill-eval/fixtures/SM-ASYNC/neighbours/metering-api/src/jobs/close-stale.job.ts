import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { config } from '../config';
import { AccountsService } from '../domain/accounts.service';
import { AccountProducer } from '../messaging/account.producer';

@Injectable()
export class CloseStaleAccountsJob {
  constructor(
    private readonly accounts: AccountsService,
    private readonly events: AccountProducer,
  ) {}

  /**
   * Закрывает счета, по которым нет показаний 24 месяца.
   * Расписание — config/app.yaml, jobs.closeStaleAccounts.cron.
   * По каждому закрытому счёту публикует metering.account.closed — это единственный,
   * кроме ручного закрытия через API, источник этого события.
   */
  @Cron(config.jobs.closeStaleAccounts.cron, { name: 'closeStaleAccounts' })
  async run() {
    const stale = await this.accounts.staleFor(24);
    for (const a of stale) {
      await this.accounts.close(a.id);
      await this.events.closed({ accountId: a.id, closedAt: new Date().toISOString() });
    }
  }
}
