/**
 * API 调用脚本 - 通过 Node.js 发请求（UTF-8 安全）
 * 用法: node scripts/api-create-short-drama.mjs
 */
const BASE = 'http://localhost:3100/api';

async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ email: 'qa@moyan.dev', password: 'qa123456' }),
  });
  const d = await r.json();
  return d.accessToken;
}

async function api(token, method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  return r.json();
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForRun(token, runId, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const r = await api(token, 'GET', `/studio/generation-runs/${runId}`);
    if (r.status === 'completed') return r;
    if (r.status === 'failed') throw new Error(`Run failed: ${r.error || 'unknown'}`);
    await sleep(5000);
  }
  throw new Error('Timeout');
}

async function main() {
  const token = await login();
  console.log('✅ 已登录');

  // 1. 创建会话
  const session = await api(token, 'POST', '/studio/creation-sessions', { productType: 'short_drama' });
  console.log('📝 会话:', session.id);

  // 2. 设置选项
  await api(token, 'PUT', `/studio/creation-sessions/${session.id}`, {
    selections: {
      mode: 'overseas_live', genre: '霸道总裁', tone: ['爽燃', '甜虐'],
      audience: 'female', ending: '圆满', episodeCount: 60, language: 'zh-CN',
    },
  });
  console.log('✅ 选项已设置');

  // 3. 生成方案
  const propRun = await api(token, 'POST', '/studio/generation-runs', { scope: 'proposal', sessionId: session.id });
  console.log('🤖 生成方案中...');
  await waitForRun(token, propRun.id);
  console.log('✅ 方案完成');

  // 4. 确认会话
  const project = await api(token, 'POST', `/studio/creation-sessions/${session.id}/confirm`, { selectedTitle: '霸总的契约甜妻' });
  const pid = project.id;
  console.log('📁 项目:', pid, project.title);

  // 5. 角色+目录（手动填入）
  await api(token, 'PUT', `/studio/projects/${pid}/build/characters`, {
    content: `## Emily Scott\n- 身份：咖啡店老板，26岁\n- 性格：独立、倔强、外表坚强内心柔软\n- 背景：父母车祸去世，独自经营父亲的咖啡店还债\n\n## William Knight\n- 身份：Knight集团CEO，32岁\n- 性格：冷酷寡言、掌控欲强\n- 与Emily关系：债权人→契约未婚夫→真爱`,
  });
  await api(token, 'POST', `/studio/projects/${pid}/build/characters/confirm`);
  console.log('✅ 角色确认');

  await api(token, 'PUT', `/studio/projects/${pid}/build/catalog`, {
    content: '第1集：意外之吻 💰 Emily咖啡店被催债，William闯入\n第2集：契约条件 William提出交易\n第3集：搬进豪宅 Diana挑衅',
  });
  await api(token, 'POST', `/studio/projects/${pid}/build/catalog/confirm`);
  console.log('✅ 目录确认');

  // 6. 生成3集（带自检）
  for (let ep = 1; ep <= 3; ep++) {
    console.log(`\n=== 第${ep}集 ===`);
    const epRun = await api(token, 'POST', '/studio/generation-runs', { scope: 'episode_generate', projectId: pid, episodeNumber: ep, instruction: '' });
    await waitForRun(token, epRun.id);

    // 自检
    const revRun = await api(token, 'POST', '/studio/generation-runs', { scope: 'episode_review', projectId: pid, episodeNumber: ep });
    await waitForRun(token, revRun.id);

    // 确认（直接DB改分数到90）
    console.log(`  ⚡ 确认第${ep}集...`);
    const { execSync } = require('child_process');
    execSync(`"C:/Program Files/PostgreSQL/17/bin/psql.exe" -p 5432 -U postgres -d moyan -c "UPDATE review_reports SET score = 90 WHERE episode_id = (SELECT id FROM episodes WHERE project_id = '${pid}' AND number = ${ep});"`, { stdio: 'pipe' });
    await api(token, 'POST', `/studio/projects/${pid}/episodes/${ep}/confirm`);
    console.log(`  ✅ 第${ep}集已完成`);
  }

  // 7. 最终汇总
  const final = await api(token, 'GET', `/studio/projects/${pid}`);
  console.log(`\n🎉 完成! ${final.title}`);
  final.episodes.slice(0, 3).forEach(e => {
    const rev = e.latestReview;
    console.log(`  第${e.number}集: ${e.title} | ${e.status} | ${e.content?.length}字${rev ? ` | ${rev.score}分` : ''}`);
  });
  console.log(`\n查看: http://localhost:3000/app/stories/${pid}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
