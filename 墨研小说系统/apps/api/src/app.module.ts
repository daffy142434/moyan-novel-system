import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import path from 'node:path';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { SkillsModule } from './skills/skills.module';
import { StorageModule } from './storage/storage.module';
import { StudioModule } from './studio/studio.module';
import { AdminModule } from './admin/admin.module';
import { MembershipModule } from './membership/membership.module';
import { SubmissionModule } from './submissions/submission.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.resolve(process.cwd(), '../../.env'), path.resolve(process.cwd(), '.env')],
    }),
    DatabaseModule,
    StorageModule,
    AuthModule,
    SkillsModule,
    StudioModule,
    AdminModule,
    MembershipModule,
    SubmissionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
