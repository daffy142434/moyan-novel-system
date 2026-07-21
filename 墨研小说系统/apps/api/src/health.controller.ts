import { Controller, Get, Inject } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller('health')
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Get()
  async health() {
    const result = await this.database.query<{ now: string }>('select now()::text as now');
    return {
      status: 'ok',
      database: 'connected',
      databaseTime: result.rows[0].now,
      redis: 'not-configured',
    };
  }
}
