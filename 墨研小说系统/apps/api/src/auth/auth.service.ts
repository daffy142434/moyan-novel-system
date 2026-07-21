import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { AuthResponseDto, UserDto } from '@moyan/contracts';
import { DatabaseService } from '../database/database.service';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(50).optional(),
});

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  status: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is required');
    this.jwtSecret = secret;
  }

  async register(input: unknown): Promise<AuthResponseDto> {
    const parsed = credentialsSchema.safeParse(input);
    if (!parsed.success || !parsed.data.displayName) {
      throw new BadRequestException({ code: 'INVALID_REGISTRATION', issues: parsed.error?.issues ?? [] });
    }
    const existing = await this.database.query('select 1 from users where lower(email) = $1', [parsed.data.email]);
    if (existing.rowCount) throw new BadRequestException({ code: 'EMAIL_ALREADY_REGISTERED' });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = await this.database.query<UserRow>(
      `insert into users(email, password_hash, display_name)
       values ($1, $2, $3)
       returning id, email, password_hash, display_name, status`,
      [parsed.data.email, passwordHash, parsed.data.displayName],
    );
    return this.issue(result.rows[0]);
  }

  async login(input: unknown): Promise<AuthResponseDto> {
    const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_CREDENTIALS_FORMAT' });
    const result = await this.database.query<UserRow>(
      `select id, email, password_hash, display_name, status
       from users where lower(email) = $1`,
      [parsed.data.email],
    );
    const user = result.rows[0];
    if (!user || user.status !== 'active' || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    return this.issue(user);
  }

  verify(token: string): AuthenticatedUser {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new Error('invalid payload');
      return { id: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN' });
    }
  }

  private issue(user: UserRow): AuthResponseDto {
    const userDto: UserDto = { id: user.id, email: user.email, displayName: user.display_name };
    return {
      accessToken: jwt.sign({ email: user.email }, this.jwtSecret, { subject: user.id, expiresIn: '12h' }),
      user: userDto,
    };
  }
}
