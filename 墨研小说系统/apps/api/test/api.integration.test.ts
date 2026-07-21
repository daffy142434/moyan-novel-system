import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/main';
import { DatabaseService } from '../src/database/database.service';

let app: INestApplication;
let database: DatabaseService;
let accessToken = '';
let userId = '';
let projectId = '';
const email = `api-test-${Date.now()}@moyan.local`;
const password = 'Local-test-2026!';

before(async () => {
  app = await createApp();
  await app.init();
  database = app.get(DatabaseService);
});

after(async () => {
  if (projectId) await database.query('delete from projects where id = $1', [projectId]);
  if (userId) await database.query('delete from users where id = $1', [userId]);
  await app.close();
});

test('health endpoint uses the real PostgreSQL connection', async () => {
  const response = await request(app.getHttpServer()).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'connected');
  assert.equal(response.body.redis, 'not-configured');
  assert.ok(response.body.databaseTime);
});

test('register and login use the real users table', async () => {
  const registration = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password, displayName: '接口测试用户' })
    .expect(201);
  assert.ok(registration.body.accessToken);
  userId = registration.body.user.id;

  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(201);
  assert.equal(login.body.user.id, userId);
  accessToken = login.body.accessToken;
});

test('protected endpoint rejects anonymous requests', async () => {
  await request(app.getHttpServer()).get('/api/projects').expect(401);
});

test('project and all eight workflow nodes are persisted', async () => {
  const created = await request(app.getHttpServer())
    .post('/api/projects')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: '雨夜来信',
      genre: '悬疑推理',
      coreIdea: '女记者收到失踪七年的姐姐寄来的信，并循着信中线索调查旧案。',
      coreConflict: '她必须在保护家人与揭开真相之间做出选择，同时躲避真正凶手的追杀。',
      tone: '克制、紧张、带有温情',
    })
    .expect(201);
  projectId = created.body.id;
  assert.equal(created.body.steps.length, 8);
  assert.equal(created.body.steps[0].status, 'available');
  assert.equal(created.body.steps[1].status, 'not_started');

  const listed = await request(app.getHttpServer())
    .get('/api/projects')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  assert.ok(listed.body.some((project: { id: string }) => project.id === projectId));
});

test('skill prompt is read from disk and the user override is persisted', async () => {
  const prompt = await request(app.getHttpServer())
    .get(`/api/projects/${projectId}/steps/outline/prompt`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  assert.match(prompt.body.basePrompt, /短篇|大纲/);
  assert.equal(prompt.body.content, '');

  const saved = await request(app.getHttpServer())
    .put(`/api/projects/${projectId}/steps/outline/prompt`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ content: '强化雨夜意象，但不要提前暴露凶手身份。' })
    .expect(200);
  assert.equal(saved.body.content, '强化雨夜意象，但不要提前暴露凶手身份。');
  assert.equal(saved.body.version, 1);
});

test('generation endpoint creates a real run and reports missing provider configuration clearly', async () => {
  if (process.env.DEEPSEEK_API_KEY) return;
  const created = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/generation-runs`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      stepKey: 'outline',
      instruction: '突出调查推进和姐妹情感线。',
      idempotencyKey: `api-test-${Date.now()}`,
    })
    .expect(201);
  assert.equal(created.body.status, 'queued');

  let run = created.body;
  for (let attempt = 0; attempt < 30 && !['failed', 'completed'].includes(run.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const response = await request(app.getHttpServer())
      .get(`/api/generation-runs/${run.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    run = response.body;
  }
  assert.equal(run.status, 'failed');
  assert.equal(run.errorCode, 'DEEPSEEK_NOT_CONFIGURED');
});
