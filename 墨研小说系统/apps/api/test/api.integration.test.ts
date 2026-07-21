import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/main';
import { DatabaseService } from '../src/database/database.service';
import { DeepSeekService } from '../src/generation/deepseek.service';

let app: INestApplication;
let database: DatabaseService;
let accessToken = '';
let userId = '';
let creationSessionId = '';
let studioProjectId = '';
const email = `api-test-${Date.now()}@moyan.local`;
const password = 'Local-test-2026!';

before(async () => {
  app = await createApp();
  await app.init();
  database = app.get(DatabaseService);
});

after(async () => {
  if (studioProjectId) await database.query('delete from projects where id = $1', [studioProjectId]);
  if (creationSessionId) await database.query('delete from creation_sessions where id = $1', [creationSessionId]);
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
  await request(app.getHttpServer()).get('/api/studio/projects').expect(401);
});

test('studio exposes Skill-driven products and persists pre-project selections', async () => {
  const products = await request(app.getHttpServer())
    .get('/api/studio/products')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  const shortDrama = products.body.find((item: { type: string }) => item.type === 'short_drama');
  const comicDrama = products.body.find((item: { type: string }) => item.type === 'comic_drama');
  assert.equal('command' in shortDrama, false);
  assert.equal(shortDrama.modes.length, 3);
  assert.equal(products.body.some((item: { type: string }) => item.type === 'short_novel_five_chapter'), false);
  assert.equal(comicDrama.visualStyles.length, 6);
  assert.equal(shortDrama.genres.find((item: { value: string }) => item.value === '战神归来').channel, 'male');
  assert.equal(shortDrama.genres.find((item: { value: string }) => item.value === '都市情感').channel, 'female');

  const created = await request(app.getHttpServer())
    .post('/api/studio/creation-sessions')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ productType: 'short_drama' })
    .expect(201);
  creationSessionId = created.body.id;
  const updated = await request(app.getHttpServer())
    .put(`/api/studio/creation-sessions/${creationSessionId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ selections: { mode: 'domestic', genre: '励志逆袭', audience: 'all' } })
    .expect(200);
  assert.equal(updated.body.selections.genre, '励志逆袭');
  assert.equal(updated.body.selections.audience, 'all');
});

test('dashboard reports membership and current studio projects', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/studio/dashboard')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  assert.equal(response.body.membership.plan, 'free');
  assert.ok(Array.isArray(response.body.recentProjects));
});

test('studio state machine creates a project only after proposal confirmation', async () => {
  const selections = {
    mode: 'domestic', genre: '励志逆袭', audience: 'all', tone: '爽燃',
    ending: '反转', episodeCount: 3, language: 'zh-CN', specialRequirements: '测试项目',
  };
  const prepared = await request(app.getHttpServer())
    .put(`/api/studio/creation-sessions/${creationSessionId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ selections, selectedTitle: '逆风而上', proposalContent: '# 创作方案\n完整测试方案' })
    .expect(200);
  assert.equal(prepared.body.selectedTitle, '逆风而上');

  const confirmed = await request(app.getHttpServer())
    .post(`/api/studio/creation-sessions/${creationSessionId}/confirm`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ selectedTitle: '逆风而上' })
    .expect(201);
  creationSessionId = '';
  studioProjectId = confirmed.body.id;
  assert.equal(confirmed.body.lifecycleStatus, 'building');
  assert.equal(confirmed.body.buildArtifacts.find((item: { stage: string }) => item.stage === 'proposal').status, 'confirmed');

  await request(app.getHttpServer())
    .put(`/api/studio/projects/${studioProjectId}/build/characters`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ content: '# 角色档案\n测试主角' })
    .expect(200);
  await request(app.getHttpServer())
    .post(`/api/studio/projects/${studioProjectId}/build/characters/confirm`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(201);
  await request(app.getHttpServer())
    .put(`/api/studio/projects/${studioProjectId}/build/catalog`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ content: '# 分集目录\n第1集：开端 | 主角遭遇危机\n第2集：反击 | 主角主动破局\n第3集：真相 | 伏笔集中回收' })
    .expect(200);
  const built = await request(app.getHttpServer())
    .post(`/api/studio/projects/${studioProjectId}/build/catalog/confirm`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(201);
  assert.equal(built.body.constructionLocked, true);
  assert.equal(built.body.episodes.length, 3);
  assert.equal(built.body.episodes[0].status, 'available');
  assert.equal(built.body.episodes[1].status, 'locked');
});

test('episode editing, annotations and 90-point confirmation gate are enforced', async () => {
  const saved = await request(app.getHttpServer())
    .put(`/api/studio/projects/${studioProjectId}/episodes/1`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ title: '开端', content: '第一集正文内容，需要局部优化。' })
    .expect(200);
  const episode = saved.body.episodes[0];
  assert.equal(episode.status, 'draft');

  const annotated = await request(app.getHttpServer())
    .post(`/api/studio/projects/${studioProjectId}/episodes/1/annotations`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ startOffset: 0, endOffset: 5, quotedText: '第一集正文', note: '开场冲突再强一些' })
    .expect(201);
  assert.equal(annotated.body.episodes[0].annotations.length, 1);

  await database.query(
    `insert into review_reports(episode_id, score, summary, suggestions, dimensions, content_version)
     values ($1,89,'还需修改','["强化开场"]'::jsonb,'{"节奏":89}'::jsonb,$2)`,
    [episode.id, episode.contentVersion],
  );
  await request(app.getHttpServer())
    .post(`/api/studio/projects/${studioProjectId}/episodes/1/confirm`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(400);

  await database.query(
    `insert into review_reports(episode_id, score, summary, suggestions, dimensions, content_version)
     values ($1,95,'达到确认标准','[]'::jsonb,'{"节奏":95}'::jsonb,$2)`,
    [episode.id, episode.contentVersion],
  );
  const confirmed = await request(app.getHttpServer())
    .post(`/api/studio/projects/${studioProjectId}/episodes/1/confirm`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(201);
  assert.equal(confirmed.body.episodes[0].status, 'confirmed');
  assert.equal(confirmed.body.episodes[1].status, 'available');
});

test('studio generation streams through a cancellable run and records separated prompts', async () => {
  const deepSeek = app.get(DeepSeekService);
  const originalGenerate = deepSeek.generateJsonStream;
  deepSeek.generateJsonStream = async () => {
    throw { getResponse: () => ({ code: 'DEEPSEEK_NOT_CONFIGURED', message: '测试阻断模型请求' }) };
  };
  const input = { scope: 'episode_generate', projectId: studioProjectId, episodeNumber: 2, instruction: '突出调查推进和姐妹情感线。' };
  const created = await request(app.getHttpServer()).post('/api/studio/generation-runs').set('Authorization', `Bearer ${accessToken}`).send(input).expect(201);
  let run = created.body;
  for (let attempt = 0; attempt < 30 && !['failed', 'completed'].includes(run.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    run = (await request(app.getHttpServer()).get(`/api/studio/generation-runs/${run.id}`).set('Authorization', `Bearer ${accessToken}`).expect(200)).body;
  }
  assert.equal(run.status, 'failed');
  assert.equal(run.errorCode, 'DEEPSEEK_NOT_CONFIGURED');
  const promptLog = await database.query<{ skill_prompt: string; orchestration_prompt: string; full_system_prompt: string }>(
    `select skill_prompt, orchestration_prompt, full_system_prompt
     from model_prompt_debug_logs where user_id = $1 and project_id = $2 order by created_at desc limit 1`,
    [userId, studioProjectId],
  );
  assert.ok(promptLog.rows[0].skill_prompt.length > 100);
  assert.match(promptLog.rows[0].orchestration_prompt, /第 2 集/);
  assert.ok(promptLog.rows[0].full_system_prompt.includes(promptLog.rows[0].skill_prompt));

  deepSeek.generateJsonStream = async (_system, _user, signal, callbacks) => new Promise((_, reject) => {
    callbacks.reasoning?.('正在分析剧情上下文');
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  const cancellable = await request(app.getHttpServer()).post('/api/studio/generation-runs').set('Authorization', `Bearer ${accessToken}`).send(input).expect(201);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await request(app.getHttpServer()).post(`/api/studio/generation-runs/${cancellable.body.id}/cancel`).set('Authorization', `Bearer ${accessToken}`).expect(201);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const cancelled = await request(app.getHttpServer()).get(`/api/studio/generation-runs/${cancellable.body.id}`).set('Authorization', `Bearer ${accessToken}`).expect(200);
  assert.equal(cancelled.body.status, 'cancelled');
  assert.match(cancelled.body.reasoning, /分析剧情/);
  deepSeek.generateJsonStream = originalGenerate;
});

test('project deletion removes the owned novel and all dependent writing data', async () => {
  const deleted = await request(app.getHttpServer())
    .delete(`/api/studio/projects/${studioProjectId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  assert.equal(deleted.body.deleted, true);
  assert.equal(deleted.body.id, studioProjectId);

  await request(app.getHttpServer())
    .get(`/api/studio/projects/${studioProjectId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(404);
  const dependencies = await database.query<{ builds: string; episodes: string }>(
    `select
       (select count(*) from project_build_artifacts where project_id = $1)::text as builds,
       (select count(*) from episodes where project_id = $1)::text as episodes`,
    [studioProjectId],
  );
  assert.equal(dependencies.rows[0].builds, '0');
  assert.equal(dependencies.rows[0].episodes, '0');
  studioProjectId = '';
});
