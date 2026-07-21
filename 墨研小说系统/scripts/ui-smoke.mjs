import { chromium } from '@playwright/test';

const email = `ui-test-${Date.now()}@moyan.local`;
const password = 'Local-ui-test-2026!';
const displayName = '页面测试用户';
const projectTitle = `页面测试小说-${Date.now()}`;
const stepTitles = ['故事大纲', '人物小传', '章节目录', '第一章', '第二章', '第三章', '第四章', '第五章'];
const report = { email, projectTitle, stepsVisited: [], consoleErrors: [], pageErrors: [], failedResponses: [] };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

page.on('console', (entry) => {
  if (entry.type() === 'error') report.consoleErrors.push(entry.text());
});
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

  await page.getByRole('button', { name: '新建小说' }).click();
  await page.getByLabel('暂定书名').fill(projectTitle);
  await page.getByLabel('故事题材').click();
  await page.getByText('悬疑推理', { exact: true }).last().click();
  await page.getByLabel('故事核心').fill('一名记者收到失踪姐姐从七年前寄来的信，并循着信中的线索调查旧案。');
  await page.getByLabel('核心冲突').fill('她必须在保护家人与揭开真相之间做出选择，同时躲避真正凶手的追踪。');
  await page.getByLabel('叙事基调').fill('克制、紧张、带有温情');
  await page.getByRole('button', { name: '创建并进入工作台' }).click();
  await page.waitForURL('**/app/projects/*');
  await page.locator('.step-button').first().waitFor();

  if (await page.locator('.step-button').count() !== 8) throw new Error('创作流程节点数量不是 8');

  for (let index = 0; index < stepTitles.length; index += 1) {
    await page.locator('.step-button').nth(index).click();
    await page.locator('h3').filter({ hasText: stepTitles[index] }).waitFor();
    const prompt = page.getByPlaceholder(/加强环境细节/);
    await prompt.fill(`页面联调：${stepTitles[index]}需要保持悬疑感。`);
    await page.getByRole('button', { name: /保存补充提示词/ }).click();
    const successToast = page.getByText('补充提示词已保存', { exact: true }).last();
    await successToast.waitFor();
    await successToast.waitFor({ state: 'hidden' });
    report.stepsVisited.push(stepTitles[index]);
  }

  await page.locator('.step-button').first().click();
  await page.getByPlaceholder('只影响本次生成，可以留空').fill('突出姐妹情感线，并保持线索公平。');
  await page.getByRole('button', { name: '开始生成' }).click();
  await page.getByText('生成失败', { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText('服务端尚未配置新的 DeepSeek API Key。', { exact: true }).first().waitFor();

  await page.getByRole('link', { name: /我的创作/ }).click();
  await page.waitForURL('**/app');
  await page.getByText(projectTitle, { exact: true }).waitFor();

  await page.locator('.topbar button').click();
  await page.getByText('退出登录', { exact: true }).click();
  await page.waitForURL('http://localhost:3000/');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录墨研' }).click();
  await page.waitForURL('**/app');
  await page.getByText(projectTitle, { exact: true }).waitFor();

  await page.screenshot({ path: '.runtime/ui-smoke-final.png', fullPage: true });
  if (report.consoleErrors.length || report.pageErrors.length || report.failedResponses.length) {
    throw new Error(`页面检测到异常：${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({ status: 'passed', ...report }, null, 2));
} catch (error) {
  await page.screenshot({ path: '.runtime/ui-smoke-failure.png', fullPage: true }).catch(() => undefined);
  console.error(JSON.stringify({ status: 'failed', ...report, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await page.close();
  await browser.close();
}
