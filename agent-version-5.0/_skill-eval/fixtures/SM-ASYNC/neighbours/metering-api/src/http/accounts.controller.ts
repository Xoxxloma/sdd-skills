import { Controller, Get, Post, Param } from '@nestjs/common';
import { AccountsService } from '../domain/accounts.service';

@Controller('api/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  /** Список лицевых счетов участка. */
  @Get()
  list() {
    return this.accounts.list();
  }

  /** История начислений и показаний по счёту. */
  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.accounts.history(id);
  }

  /** Закрытие лицевого счёта. */
  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.accounts.close(id);
  }
}
