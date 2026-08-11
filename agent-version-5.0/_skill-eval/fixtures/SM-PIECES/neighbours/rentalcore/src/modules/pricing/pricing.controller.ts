import { Controller, Get } from '@nestjs/common';

@Controller('/api/pricing')
export class PricingController {
  @Get('/quote')
  quote() {}
}
