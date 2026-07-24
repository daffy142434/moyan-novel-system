import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SubmissionController, AdminReviewController } from './submission.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SubmissionController, AdminReviewController],
})
export class SubmissionModule {}
