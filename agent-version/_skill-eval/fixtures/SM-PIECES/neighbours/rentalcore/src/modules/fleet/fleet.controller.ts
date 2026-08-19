import { Controller, Get, Post } from '@nestjs/common';
import { RentalError } from '../common/errors';

@Controller('/api/fleet')
export class FleetController {
  @Get() list() {}

  @Post('/decommission')
  decommission() {
    throw new RentalError('UNIT_DECOMMISSIONED');
  }
}
