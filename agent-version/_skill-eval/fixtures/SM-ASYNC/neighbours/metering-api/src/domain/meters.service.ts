import { Injectable } from '@nestjs/common';

@Injectable()
export class MetersService {
  async fetchRegistry(): Promise<{ model: string }[]> {
    return [];
  }
  async upsertAll(_models: { model: string }[]) {}
  async markDiscontinuedMissing(_models: { model: string }[]) {}
}
