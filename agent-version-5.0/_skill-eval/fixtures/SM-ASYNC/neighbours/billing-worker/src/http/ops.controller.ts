import { Controller, Get } from '@nestjs/common';

@Controller()
export class OpsController {
  @Get('healthz')
  health() {
    return { status: 'ok' };
  }

  /** Очередь начислений: сколько сообщений ждёт обработки. */
  @Get('api/queue-depth')
  depth() {
    return { pending: 0 };
  }
}
