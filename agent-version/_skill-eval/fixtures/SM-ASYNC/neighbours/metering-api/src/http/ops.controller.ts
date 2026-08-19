import { Controller, Get } from '@nestjs/common';

@Controller()
export class OpsController {
  @Get('healthz')
  health() {
    return { status: 'ok' };
  }

  @Get('api/version')
  version() {
    return { build: process.env.BUILD_SHA ?? 'dev' };
  }
}
