import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs/promises';
import path from 'node:path';

@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const configured = config.get<string>('LOCAL_STORAGE_PATH', './data/storage');
    this.root = path.resolve(process.cwd(), configured);
  }

  async writeText(key: string, content: string): Promise<string> {
    const safeKey = this.resolveKey(key);
    await fs.mkdir(path.dirname(safeKey), { recursive: true });
    await fs.writeFile(safeKey, content, 'utf8');
    return key.replaceAll('\\', '/');
  }

  async readText(key: string): Promise<string> {
    return fs.readFile(this.resolveKey(key), 'utf8');
  }

  private resolveKey(key: string): string {
    const resolved = path.resolve(this.root, key);
    const relative = path.relative(this.root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid storage key');
    return resolved;
  }
}
