import { chromium } from '@playwright/test';

const email = `ui-test-${Date.now()}@moyan.local`;
const password = 'Local-ui-test-2026!';
const displayName = '页面测试用户';
const report = { email, newWorkflowVisited: [], consoleErrors: [], pageErrors: [], failedResponses: [] };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

page.on('console', (entry) => { if (entry.type() === 'error') report.consoleErrors.push(entry.text()); });
page.on('pageerror', (error) => report.pageErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) report.failedResponses.push({ status: response.status(), url: response.url() });
});

try {
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.getByText('注册', { exact: true }).click();
  await page.getByLabel('昵称').fill(displayName);
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '创建账号' }).click();
  await page.waitForURL('**/app');

  await page.getByRole('link', { name: '工作台', exact: true }).click();
  await page.waitForURL('**/app/workbench');
  if (await page.getByText('五章短篇小说', { exact: true }).count()) throw new Error('五章短篇小说入口仍然存在');
  const workbenchWidth = await page.locator('.page-wrap').evaluate((element) => element.getBoundingClientRect().width);
  if (workbenchWidth < 1600) throw new Error(`PC 工作台宽度不足：${workbenchWidth}px`);
  await page.getByText('短剧剧本创作', { exact: true }).click();
  await page.waitForURL('**/app/workbench/create/short_drama');
  await page.locator('.choice-card').filter({ hasText: '国内下沉剧' }).click();
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.locator('.choice-card').filter({ hasText: '战神归来' }).click();
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.locator('input[disabled][value="男频"]').waitFor();
  await page.locator('label.ant-radio-button-wrapper').filter({ hasText: '爽燃' }).click();
  await page.locator('label.ant-radio-button-wrapper').filter({ hasText: '反转' }).click();
  await page.getByPlaceholder(/人物职业/).fill('浏览器验证，不调用模型');
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.getByRole('heading', { name: '生成并确认创作方案' }).waitFor();
  await page.getByText('选择已完成', { exact: true }).waitFor();
  await page.getByText('战神归来', { exact: true }).last().waitFor();
  await page.locator('.ant-descriptions-item-content').filter({ hasText: '男频' }).waitFor();
  report.newWorkflowVisited.push('模式选择', '题材选择', '频道锁定', '补充设定', '方案汇总');

  await page.getByRole('link', { name: '首页', exact: true }).click();
  await page.waitForURL('**/app');
  await page.getByRole('button', { name: new RegExp(displayName) }).click();
  await page.getByText('退出登录', { exact: true }).click();
  await page.waitForURL('http://localhost:3000/');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录墨研' }).click();
  await page.waitForURL('**/app');
  await page.getByRole('heading', { name: '创作首页' }).waitFor();

  await page.screenshot({ path: '.runtime/ui-smoke-final.png', fullPage: true });
  if (report.consoleErrors.length || report.pageErrors.length || report.failedResponses.length) throw new Error(`页面检测到异常：${JSON.stringify(report)}`);
  console.log(JSON.stringify({ status: 'passed', ...report }, null, 2));
} catch (error) {
  await page.screenshot({ path: '.runtime/ui-smoke-failure.png', fullPage: true }).catch(() => undefined);
  console.error(JSON.stringify({ status: 'failed', ...report, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await page.close();
  await browser.close();
}
