import { Controller, Get, Post } from '@nestjs/common';
import { RentalError } from '../common/errors';

@Controller('/api/orders')
export class OrdersController {
  @Get()
  list() {}

  @Post()
  create() {
    throw new RentalError('DUPLICATE_CONTRACT_NO');
  }

  @Post('/close')
  close() {
    throw new RentalError('RENTAL_ALREADY_CLOSED');
  }
}
