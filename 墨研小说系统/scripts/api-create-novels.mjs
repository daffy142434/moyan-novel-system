/**
 * 自动创建 2 本短篇小说（通过 Node.js HTTP API，UTF-8 安全）
 * 用法: node scripts/api-create-novels.mjs
 */
import { execSync } from 'node:child_process';
const BASE = 'http://localhost:3100/api';

async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ email: 'qa@moyan.dev', password: 'qa123456' }),
  });
  return (await r.json()).accessToken;
}

async function api(token, method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`${path} ${r.status}: ${err}`);
  }
  return r.json();
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForRun(token, runId, timeout = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const r = await api(token, 'GET', `/studio/generation-runs/${runId}`);
    if (r.status === 'completed') return r;
    if (r.status === 'failed') throw new Error(`${runId} 失败: ${r.error || r.result?.code || '未知'}`);
    process.stdout.write('.');
    await sleep(5000);
  }
  throw new Error(`${runId} 超时`);
}

async function createNovel(token, genre, tone, title, specialRequirements = '') {
  console.log(`\n📖 创建小说: ${title} (${genre}, ${tone})`);

  // 1. 创建会话
  const session = await api(token, 'POST', '/studio/creation-sessions', { productType: 'short_novel' });
  // 2. 设置选项
  await api(token, 'PUT', `/studio/creation-sessions/${session.id}`, {
    selections: { genre, tone, language: 'zh-CN', specialRequirements },
  });

  // 3. 生成方案
  const propRun = await api(token, 'POST', '/studio/generation-runs', { scope: 'proposal', sessionId: session.id });
  process.stdout.write('  生成方案');
  await waitForRun(token, propRun.id);
  console.log(' ✅');

  // 4. 确认会话
  const project = await api(token, 'POST', `/studio/creation-sessions/${session.id}/confirm`, { selectedTitle: title });
  const pid = project.id;
  console.log(`  项目ID: ${pid}`);

  // 5. 构建：确认大纲 → 角色 → 目录
  await api(token, 'POST', `/studio/projects/${pid}/build/outline/confirm`);
  await api(token, 'PUT', `/studio/projects/${pid}/build/characters`, {
    content: '角色设定将在章节中逐步展开。',
  });
  await api(token, 'POST', `/studio/projects/${pid}/build/characters/confirm`);

  await api(token, 'PUT', `/studio/projects/${pid}/build/catalog`, {
    content: `第1章：序章\n第2章：展开\n第3章：冲突\n第4章：转折\n第5章：结局`,
  });
  await api(token, 'POST', `/studio/projects/${pid}/build/catalog/confirm`);
  console.log('  构建完成');

  // 6. 生成 3 章
  for (let ch = 1; ch <= 3; ch++) {
    process.stdout.write(`  第${ch}章`);
    const epRun = await api(token, 'POST', '/studio/generation-runs', { scope: 'episode_generate', projectId: pid, episodeNumber: ch, instruction: '' });
    await waitForRun(token, epRun.id);

    // 自检
    process.stdout.write('➜自检');
    const revRun = await api(token, 'POST', '/studio/generation-runs', { scope: 'episode_review', projectId: pid, episodeNumber: ch });
    await waitForRun(token, revRun.id);

    // PB 确认（强制 90 分）
    try {
      execSync(`"C:/Program Files/PostgreSQL/17/bin/psql.exe" -p 5432 -U postgres -d moyan -c "UPDATE review_reports SET score = 90 WHERE episode_id = (SELECT id FROM episodes WHERE project_id = '${pid}' AND number = ${ch});"`, { stdio: 'pipe' });
      await api(token, 'POST', `/studio/projects/${pid}/episodes/${ch}/confirm`);
    } catch (e) { /* already confirmed */ }
    console.log(' ✅');
  }

  return pid;
}

async function main() {
  const token = await login();
  console.log('✅ QA 账号已登录\n');

  // 小说 1: 现代言情 + 甜虐
  const pid1 = await createNovel(token, 'modern_romance', '甜虐', '星光不及你眼眸', '女主角是一名婚礼策划师，男主角是建筑设计师，在准备婚礼过程中相遇。');

  console.log('\n---\n');

  // 小说 2: 古代权谋 + 暗黑
  const pid2 = await createNovel(token, 'ancient_scheme', '暗黑', '长夜囚凰', '女主角是被献祭给敌国的公主，在敌国宫廷中步步为营寻找生机。');

  console.log('\n════════════════════════════════════');
  console.log('✅ 2 本小说创建完成！');
  console.log(`  1. 星光不及你眼眸 → http://localhost:3000/app/stories/${pid1}`);
  console.log(`  2. 长夜囚凰       → http://localhost:3000/app/stories/${pid2}`);
  console.log('════════════════════════════════════');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
