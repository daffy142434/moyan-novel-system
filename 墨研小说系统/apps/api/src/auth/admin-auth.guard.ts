import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';

const resolveUser = async (context: ExecutionContext, auth: AuthService, db: DatabaseService) => {
  const request = context.switchToHttp().getRequest();
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    const user = auth.verify(authorization.slice(7));
    request.user = user;
    return (await db.query('SELECT role FROM users WHERE id = $1', [user.id])).rows[0] || null;
  } catch { return null; }
};

@Injectable()
export class AdminGuard implements CanActivate {
  @Inject(AuthService) private readonly auth!: AuthService;
  @Inject(DatabaseService) private readonly db!: DatabaseService;
  async canActivate(ctx: ExecutionContext) {
    const row = await resolveUser(ctx, this.auth, this.db);
    return row?.role === 'admin';
  }
}

/** 运营权限: admin 或 operator 均可 */
@Injectable()
export class OperatorGuard implements CanActivate {
  @Inject(AuthService) private readonly auth!: AuthService;
  @Inject(DatabaseService) private readonly db!: DatabaseService;
  async canActivate(ctx: ExecutionContext) {
    const row = await resolveUser(ctx, this.auth, this.db);
    return row?.role === 'admin' || row?.role === 'operator';
  }
}
