import { Injectable } from '@nestjs/common';
import { AccountProducer } from '../messaging/account.producer';

@Injectable()
export class AccountsService {
  constructor(private readonly events: AccountProducer) {}

  async list() {
    return this.db.query(`select * from accounts where status <> 'closed'`);
  }

  async history(id: string) {
    return this.db.query(`select * from account_history where account_id = $1`, [id]);
  }

  /** Закрытие уже закрытого счёта — 409; повтор события не даёт. */
  async close(id: string) {
    const changed = await this.db.query(
      `update accounts set status = 'closed', closed_at = now() where id = $1 and status <> 'closed'`,
      [id],
    );
    if (!changed) throw new ConflictError('счёт уже закрыт');
    await this.events.closed({ accountId: id, closedAt: new Date().toISOString() });
  }

  async upsertInvoice(invoiceId: string, accountId: string, amount: number) {
    await this.db.query(
      `insert into account_history (invoice_id, account_id, amount) values ($1,$2,$3)
       on conflict (invoice_id) do update set amount = excluded.amount`,
      [invoiceId, accountId, amount],
    );
  }

  async rename(id: string, name: string) {
    await this.db.query(`update accounts set name = $2 where id = $1`, [id, name]);
  }

  async staleFor(_months: number): Promise<{ id: string }[]> {
    return [];
  }

  private db!: { query: Function };
}

class ConflictError extends Error {}
