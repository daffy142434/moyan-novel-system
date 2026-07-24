import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MembershipController } from './membership.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [MembershipController],
})
export class MembershipModule {}
