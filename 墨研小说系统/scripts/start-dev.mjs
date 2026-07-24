import { spawn, execSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

// 1. Kill any existing PG / node
try { execSync('taskkill /F /IM node.exe', { stdio: 'ignore' }); } catch {}
try { execSync('taskkill /F /IM postgres.exe', { stdio: 'ignore' }); } catch {}
await setTimeout(2000);

// 2. Start PG
const pg = spawn('C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe', [
  'start', '-D', 'C:/Program Files/PostgreSQL/17/data',
  '-l', 'C:/Program Files/PostgreSQL/17/data/startup.log',
], { stdio: 'inherit', detached: false });

await new Promise((resolve, reject) => {
  pg.on('close', (code) => code === 0 ? resolve() : reject(new Error(`PG exit ${code}`)));
});
console.log('[dev] PostgreSQL started');

await setTimeout(2000);

// 3. Run migration
execSync('node node_modules/tsx/dist/cli.mjs apps/api/src/database/migrate.ts', {
  stdio: 'inherit',
});

// 4. Start dev server
const dev = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

dev.on('close', (code) => {
  console.log(`[dev] exited with code ${code}`);
  process.exit(code ?? 0);
});

process.on('SIGTERM', () => dev.kill());
process.on('SIGINT', () => { dev.kill(); process.exit(); });
