/**
 * 测试执行器
 * 用法: tsx runner.ts                    → 运行所有预置脚本
 *       tsx runner.ts --script=workflow  → 运行指定脚本
 *       tsx runner.ts --script=custom    → 运行 custom/ 下的自定义脚本
 *       tsx runner.ts --headless=false   → 有头模式 (调试用)
 *       tsx runner.ts --base=http://localhost:3000 --api=http://localhost:3100/api
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { checkServices, setScreenshotDir } from './helpers/index';

// ========== 配置 ==========
const args = process.argv.slice(2);
const getArg = (key: string) => {
  const entry = args.find((a) => a.startsWith(`--${key}=`));
  return entry ? entry.split('=')[1] : undefined;
};

const HEADLESS = getArg('headless') !== 'false';
const SCRIPT_NAME = getArg('script');
const BASE_URL = getArg('base') ?? 'http://localhost:3000';
const API_URL = getArg('api') ?? 'http://localhost:3100/api';

// ========== 脚本发现 ==========
interface TestScript {
  name: string;
  file: string;
  description: string;
  run: (page: import('playwright').Page) => Promise<void>;
}

async function discoverScripts(): Promise<TestScript[]> {
  const scripts: TestScript[] = [];
  const sources = SCRIPT_NAME
    ? SCRIPT_NAME === 'custom'
      ? [path.join(__dirname, 'custom')]
      : [path.join(__dirname, 'scripts')]
    : [path.join(__dirname, 'scripts'), path.join(__dirname, 'custom')];

  for (const dir of sources) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
      if (file.includes('.d.ts')) continue;
      try {
        const filePath = path.join(dir, file);
        const url = pathToFileURL(filePath).href;
        const mod = await import(url);
        if (mod.default?.run) {
          scripts.push({
            name: file.replace(/\.(ts|js)$/, ''),
            file: path.relative(__dirname, path.join(dir, file)),
            description: mod.default.description ?? '',
            run: mod.default.run,
          });
        }
      } catch (err) {
        console.warn(`  ⚠ 跳过 ${file}: ${(err as Error).message}`);
      }
    }
  }
  return scripts;
}

// ========== 执行 ==========
async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const resultDir = path.join(__dirname, 'results', timestamp);
  fs.mkdirSync(resultDir, { recursive: true });
  setScreenshotDir(resultDir);

  console.log('┌──────────────────────────────────────────┐');
  console.log('│       墨研小说系统 自动化测试             │');
  console.log('├──────────────────────────────────────────┤');
  console.log(`│  前端: ${BASE_URL}`);
  console.log(`│  API:  ${API_URL}`);
  console.log(`│  模式: ${HEADLESS ? 'headless (后台)' : 'headed (调试)'}`);
  console.log(`│  结果: ${path.relative(process.cwd(), resultDir)}`);
  console.log('└──────────────────────────────────────────┘');

  // 环境检查
  console.log('\n【环境检查】');
  const check = await checkServices();
  if (!check.api) { console.error('  ❌ API 服务未启动'); process.exit(1); }
  if (!check.web) { console.error('  ❌ 前端服务未启动'); process.exit(1); }
  console.log('  ✅ API + 前端 均已就绪');

  // 发现脚本
  const scripts = await discoverScripts();
  if (scripts.length === 0) {
    console.log('\n  ⚠ 未发现测试脚本。请在 scripts/ 或 custom/ 目录添加脚本文件。');
    process.exit(0);
  }
  console.log(`\n【发现 ${scripts.length} 个测试脚本】`);

  // 启动浏览器
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results: { name: string; status: string; duration: number; error?: string }[] = [];

  for (const script of scripts) {
    console.log(`\n▶ ${script.name}${script.description ? ` — ${script.description}` : ''}`);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'zh-CN',
    });
    const page = await context.newPage();

    const start = Date.now();
    try {
      await script.run(page);
      const duration = Date.now() - start;
      results.push({ name: script.name, status: '✅ 通过', duration });
      console.log(`  ✅ 通过 (${(duration / 1000).toFixed(1)}s)`);
    } catch (err) {
      const duration = Date.now() - start;
      const msg = (err as Error).message;
      results.push({ name: script.name, status: '❌ 失败', duration, error: msg });
      console.error(`  ❌ 失败: ${msg}`);
      try { await page.screenshot({ path: `${resultDir}/${script.name}-error.png` }); } catch { /* */ }
    } finally {
      await context.close();
    }
  }

  await browser.close();

  // 输出汇总
  const summary = [
    `# 自动化测试报告`,
    ``,
    `> 执行时间: ${timestamp}`,
    `> 前端: ${BASE_URL}`,
    ``,
    `| 脚本 | 结果 | 耗时 |`,
    `|------|------|------|`,
    ...results.map((r) => `| ${r.name} | ${r.status} | ${(r.duration / 1000).toFixed(1)}s |`),
    ``,
    `**通过:** ${results.filter((r) => r.status.includes('通过')).length}/${results.length}`,
  ];
  for (const r of results) {
    if (r.error) {
      summary.push(``, `### ${r.name} 失败详情`, `\`\`\``, r.error, `\`\`\``);
    }
  }
  fs.writeFileSync(`${resultDir}/report.md`, summary.join('\n'));

  console.log(`\n┌──────────────────────────────────────────┐`);
  console.log(`│  测试完成: ${results.filter((r) => r.status.includes('通过')).length}/${results.length} 通过`);
  console.log(`│  报告: ${path.relative(process.cwd(), resultDir)}/report.md`);
  console.log(`└──────────────────────────────────────────┘`);

  if (results.some((r) => r.status.includes('失败'))) process.exit(1);
}

main().catch((err) => {
  console.error('执行器异常:', err);
  process.exit(1);
});
