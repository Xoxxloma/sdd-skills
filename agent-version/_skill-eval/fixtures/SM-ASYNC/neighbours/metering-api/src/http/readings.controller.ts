import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ReadingsService } from '../domain/readings.service';

@Controller('api/readings')
export class ReadingsController {
  constructor(private readonly readings: ReadingsService) {}

  /** Список показаний по лицевому счёту за период. */
  @Get()
  list(@Query('accountId') accountId: string, @Query('from') from: string) {
    return this.readings.list(accountId, from);
  }

  /** Приём показания от абонента или от прибора. */
  @Post()
  submit(@Body() body: SubmitReadingDto) {
    return this.readings.submit(body);
  }

  /** Одно показание по идентификатору. */
  @Get(':id')
  byId(@Param('id') id: string) {
    return this.readings.byId(id);
  }
}

export interface SubmitReadingDto {
  accountId: string;
  value: number;
  takenAt: string;
  source: 'abonent' | 'device' | 'inspector';
}
