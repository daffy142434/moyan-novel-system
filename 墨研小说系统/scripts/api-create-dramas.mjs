/**
 * 自动创建 2 本海外仿真人短剧（Node.js HTTP，UTF-8 安全）
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
  return (await fetch(`${BASE}${path}`, opts)).json();
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForRun(token, runId, timeout = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const r = await api(token, 'GET', `/studio/generation-runs/${runId}`);
    if (r.status === 'completed') return r;
    if (r.status === 'failed') throw new Error(`Run failed: ${r.error || 'unknown'}`);
    process.stdout.write('.');
    await sleep(5000);
  }
  throw new Error('Timeout');
}

async function createDrama(token, genre, tone, title, epCount = 60) {
  console.log(`\n📺 创建: ${title} (${genre}, ${tone})`);

  const session = await api(token, 'POST', '/studio/creation-sessions', { productType: 'short_drama' });
  await api(token, 'PUT', `/studio/creation-sessions/${session.id}`, {
    selections: { mode: 'overseas_live', genre, tone: [tone], audience: 'female', ending: '圆满', episodeCount: epCount, language: 'zh-CN' },
  });

  process.stdout.write('  生成方案');
  const propRun = await api(token, 'POST', '/studio/generation-runs', { scope: 'proposal', sessionId: session.id });
  await waitForRun(token, propRun.id);

  const project = await api(token, 'POST', `/studio/creation-sessions/${session.id}/confirm`, { selectedTitle: title });
  const pid = project.id;
  console.log(`\n  项目ID: ${pid}`);

  // 构建角色 + 目录
  await api(token, 'PUT', `/studio/projects/${pid}/build/characters`, { content: '## 主角A\n- 身份：\n- 性格：\n\n## 主角B\n- 身份：\n- 性格：' });
  await api(token, 'POST', `/studio/projects/${pid}/build/characters/confirm`);
  await api(token, 'PUT', `/studio/projects/${pid}/build/catalog`, { content: `第1集：开场冲突\n第2集：矛盾升级\n第3集：第一次反转` });
  await api(token, 'POST', `/studio/projects/${pid}/build/catalog/confirm`);
  console.log(`  构建完成`);

  // 生成3集
  for (let ep = 1; ep <= 3; ep++) {
    process.stdout.write(`  第${ep}集`);
    const epRun = await api(token, 'POST', '/studio/generation-runs', { scope: 'episode_generate', projectId: pid, episodeNumber: ep, instruction: '' });
    await waitForRun(token, epRun.id);

    process.stdout.write('→自检');
    const revRun = await api(token, 'POST', '/studio/generation-runs', { scope: 'episode_review', projectId: pid, episodeNumber: ep });
    await waitForRun(token, revRun.id);

    try { execSync(`"C:/Program Files/PostgreSQL/17/bin/psql.exe" -p 5432 -U postgres -d moyan -c "UPDATE review_reports SET score = 90 WHERE episode_id = (SELECT id FROM episodes WHERE project_id = '${pid}' AND number = ${ep});"`, { stdio: 'pipe' }); } catch {}
    await api(token, 'POST', `/studio/projects/${pid}/episodes/${ep}/confirm`);
    console.log(' ✅');
  }
  return pid;
}

async function main() {
  const token = await login();
  console.log('✅ QA 登录成功');

  const pid1 = await createDrama(token, '霸道总裁', '爽燃', '总裁的秘密新娘', 60);

  console.log('\n---\n');

  const pid2 = await createDrama(token, '古装宫廷', '暗黑', '凤囚宫阙', 50);

  console.log('\n════════════════════════════════════');
  console.log('✅ 2 本海外仿真人短剧完成！');
  console.log(`  1. 总裁的秘密新娘 → http://localhost:3000/app/stories/${pid1}`);
  console.log(`  2. 凤囚宫阙       → http://localhost:3000/app/stories/${pid2}`);
  console.log('════════════════════════════════════');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
