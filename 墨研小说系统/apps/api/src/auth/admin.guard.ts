import { CanActivate, ExecutionContext, Inject, Injectable, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AdminGuard implements CanActivate {
  @Inject(DatabaseService) private readonly database!: DatabaseService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const result = await this.database.query('SELECT is_admin FROM users WHERE id = $1', [request.user.id]);
    if (!result.rows[0]?.is_admin) throw new ForbiddenException({ code: 'ADMIN_REQUIRED' });
    return true;
  }
}
