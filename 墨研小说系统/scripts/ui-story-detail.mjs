import { chromium, request } from '@playwright/test';

const api = await request.newContext({ baseURL: 'http://localhost:3100/api/' });
const stamp = Date.now();
const authResponse = await api.post('auth/register', {
  data: {
    email: `story-detail-${stamp}@moyan.local`,
    password: 'Story-detail-test-2026!',
    displayName: '详情页测试用户',
  },
});
if (!authResponse.ok()) throw new Error(`注册测试账号失败：${authResponse.status()}`);
const auth = await authResponse.json();
const headers = { Authorization: `Bearer ${auth.accessToken}` };

const sessionResponse = await api.post('studio/creation-sessions', {
  headers,
  data: { productType: 'short_drama' },
});
if (!sessionResponse.ok()) throw new Error(`创建会话失败：${sessionResponse.status()}`);
const creation = await sessionResponse.json();
const proposalContent = '# 创作方案\n\n一名县城外卖员为守住父亲留下的老店，被迫参加创业竞赛，并逐步揭开合伙人的骗局。';
await api.put(`studio/creation-sessions/${creation.id}`, {
  headers,
  data: {
    selections: {
      mode: 'domestic',
      genre: '励志逆袭',
      audience: 'all',
      tone: '爽燃',
      ending: '反转',
      episodeCount: 12,
      language: 'zh-CN',
      specialRequirements: '用于详情页 UI 回归测试',
    },
    selectedTitle: '逆风开局',
    proposalContent,
  },
});
const projectResponse = await api.post(`studio/creation-sessions/${creation.id}/confirm`, {
  headers,
  data: { selectedTitle: '逆风开局' },
});
if (!projectResponse.ok()) throw new Error(`创建测试作品失败：${projectResponse.status()}`);
const project = await projectResponse.json();

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
await context.addInitScript(({ accessToken, user }) => {
  localStorage.setItem('moyan_access_token', accessToken);
  localStorage.setItem('moyan_user', JSON.stringify(user));
}, { accessToken: auth.accessToken, user: auth.user });

const report = {
  status: 'passed',
  projectId: project.id,
  consoleErrors: [],
  pageErrors: [],
  failedResponses: [],
  views: [],
  libraryDeleteVisible: false,
  deletedViaUi: false,
};

async function inspect(name, viewport, expectedSidebarSelector) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  page.on('console', (entry) => {
    if (entry.type() === 'error') report.consoleErrors.push({ view: name, text: entry.text() });
  });
  page.on('pageerror', (error) => report.pageErrors.push({ view: name, text: error.message }));
  page.on('response', (response) => {
    if (response.status() >= 400) report.failedResponses.push({ view: name, status: response.status(), url: response.url() });
  });
  await page.goto(`http://localhost:3000/app/stories/${project.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '逆风开局' }).waitFor();
  await page.locator(expectedSidebarSelector).waitFor();
  if (name.startsWith('building')) {
    await page.getByText('已确认上下文', { exact: true }).waitFor();
    await page.getByText('创作方案', { exact: true }).last().waitFor();
    if (await page.getByText('构建规则', { exact: true }).count()) throw new Error('内部构建规则仍显示在小说构建页');
    if (await page.getByText('正文内容', { exact: true }).count()) throw new Error('小说构建页仍提前显示正文内容');
  }
  const metrics = await page.evaluate(({ selector, desktop }) => {
    const sidebarElement = document.querySelector(selector);
    const containerElement = sidebarElement?.parentElement;
    const contentElement = containerElement?.querySelector('.studio-content, .episode-main, .ant-layout-content');
    const sidebar = sidebarElement?.getBoundingClientRect();
    const container = containerElement?.getBoundingClientRect();
    const content = contentElement?.getBoundingClientRect();
    const containerStyle = containerElement ? getComputedStyle(containerElement) : null;
    const contentStyle = contentElement ? getComputedStyle(contentElement) : null;
    const overlap = sidebar && content
      ? Math.max(0, Math.min(sidebar.right, content.right) - Math.max(sidebar.left, content.left))
      : 0;
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      container: container ? { left: container.left, right: container.right, width: container.width, display: containerStyle?.display, flexDirection: containerStyle?.flexDirection, alignItems: containerStyle?.alignItems } : null,
      sidebar: sidebar ? { left: sidebar.left, right: sidebar.right, width: sidebar.width } : null,
      content: content ? { left: content.left, right: content.right, width: content.width, cssWidth: contentStyle?.width, flex: contentStyle?.flex } : null,
      overlap: desktop ? overlap : 0,
      visibleButtons: [...document.querySelectorAll('button')].filter((item) => {
        const rect = item.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length,
    };
  }, { selector: expectedSidebarSelector, desktop: viewport.width >= 900 });
  await page.screenshot({ path: `.runtime/story-detail-${name}.png`, fullPage: true });
  report.views.push({ name, viewport, metrics });
  const minimumContentWidth = viewport.width >= 900 ? 600 : viewport.width - 40;
  if (metrics.horizontalOverflow > 2 || metrics.overlap > 2 || !metrics.sidebar || !metrics.content || metrics.content.width < minimumContentWidth) report.status = 'failed';
  await page.close();
}

async function confirmCharactersInUi() {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`http://localhost:3000/app/stories/${project.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '确认并进入下一步' }).click();
  await page.getByRole('button', { name: '确认并继续' }).click();
  await page.locator('.studio-content h3').filter({ hasText: '目录大纲' }).waitFor();
  const contextSummaries = page.locator('.context-summary');
  await contextSummaries.filter({ hasText: '创作方案' }).waitFor();
  await contextSummaries.filter({ hasText: '角色开发' }).waitFor();
  await page.screenshot({ path: '.runtime/story-detail-auto-advance.png', fullPage: true });
  await page.close();
}

async function inspectEpisodeInteractions() {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`http://localhost:3000/app/stories/${project.id}`, { waitUntil: 'networkidle' });
  const toolbar = page.locator('.episode-toolbar');
  const reading = page.locator('.episode-reading');
  await toolbar.waitFor();
  await reading.waitFor();
  const [toolbarBox, readingBox] = await Promise.all([toolbar.boundingBox(), reading.boundingBox()]);
  if (!toolbarBox || !readingBox || toolbarBox.y + toolbarBox.height > readingBox.y + 2) throw new Error('正文按钮区域没有位于正文上方');

  await page.locator('.inline-annotation').click();
  await page.getByLabel('正文标注').getByText('这里需要加强冲突感', { exact: true }).waitFor();
  await page.locator('.ant-modal-confirm-btns .ant-btn-primary').click();

  let releaseStream;
  const streamGate = new Promise((resolve) => { releaseStream = resolve; });
  await page.route('**/api/studio/generation-runs**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST' && url.pathname.endsWith('/generation-runs')) {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'ui-busy-run', scope: 'episode_optimize', status: 'queued', reasoning: '', content: '' }) });
      return;
    }
    if (url.pathname.endsWith('/ui-busy-run/events')) {
      await streamGate;
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'event: run.cancelled\ndata: {}\n\n' });
      return;
    }
    if (url.pathname.endsWith('/ui-busy-run/cancel')) {
      releaseStream();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ cancelled: true }) });
      return;
    }
    await route.fallback();
  });
  await page.getByRole('button', { name: 'AI 优化' }).click();
  await page.getByRole('button', { name: '终止生成' }).waitFor();
  const toolbarButtons = page.locator('.episode-toolbar button');
  if (await toolbarButtons.count() !== await page.locator('.episode-toolbar button:disabled').count()) throw new Error('模型处理中仍有正文工具栏按钮可点击');
  if (!(await page.getByPlaceholder('本次重新生成或 AI 优化要求').isDisabled())) throw new Error('模型处理中 AI 要求输入框仍可输入');
  if (!(await page.getByRole('button', { name: '删除', exact: true }).isDisabled())) throw new Error('模型处理中标注仍可删除');
  await page.getByRole('button', { name: '终止生成' }).click();
  await page.getByText('生成已终止', { exact: true }).waitFor();
  await page.screenshot({ path: '.runtime/story-detail-stream-cancelled.png', fullPage: true });
  await page.close();
}

async function deleteStoryInUi() {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:3000/app/library', { waitUntil: 'networkidle' });
  await page.locator('.project-card button.ant-btn-dangerous').filter({ hasText: '删除' }).waitFor();
  report.libraryDeleteVisible = true;
  await page.goto(`http://localhost:3000/app/stories/${project.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '删除小说' }).click();
  await page.locator('.ant-modal-confirm-title').filter({ hasText: `确认删除《${project.title}》？` }).waitFor();
  await page.getByRole('button', { name: '永久删除' }).click();
  await page.waitForURL('**/app/library');
  await page.getByRole('heading', { name: '小说集' }).waitFor();
  if (await page.getByText(project.title, { exact: true }).count()) throw new Error('删除后的小说仍显示在小说集中');
  report.deletedViaUi = true;
  await page.screenshot({ path: '.runtime/story-detail-deleted.png', fullPage: true });
  await page.close();
}

try {
  await inspect('building-desktop', { width: 1440, height: 1000 }, '.step-sidebar');
  await inspect('building-mobile', { width: 390, height: 844 }, '.step-sidebar');

  const characterResponse = await api.put(`studio/projects/${project.id}/build/characters`, {
    headers,
    data: { content: '# 角色开发\n\n主角：周野，县城外卖员。\n对手：林敬，伪善投资人。' },
  });
  if (!characterResponse.ok()) throw new Error(`保存角色失败：${characterResponse.status()}`);
  await confirmCharactersInUi();
  const catalogResponse = await api.put(`studio/projects/${project.id}/build/catalog`, {
    headers,
    data: { content: Array.from({ length: 12 }, (_, index) => `第${index + 1}集：节点${index + 1} | 冲突升级并留下下一集钩子`).join('\n') },
  });
  if (!catalogResponse.ok()) throw new Error(`保存目录失败：${catalogResponse.status()}`);
  const builtResponse = await api.post(`studio/projects/${project.id}/build/catalog/confirm`, { headers });
  if (!builtResponse.ok()) throw new Error(`确认目录失败：${builtResponse.status()} ${await builtResponse.text()}`);

  const episodeContent = '周野冲进雨幕，攥紧被撕碎的合同。林敬站在门口冷笑，老店的招牌轰然坠地。';
  const episodeResponse = await api.put(`studio/projects/${project.id}/episodes/1`, {
    headers,
    data: { title: '雨夜反击', content: episodeContent },
  });
  if (!episodeResponse.ok()) throw new Error(`保存正文失败：${episodeResponse.status()}`);
  const quotedText = '攥紧被撕碎的合同';
  const startOffset = episodeContent.indexOf(quotedText);
  const annotationResponse = await api.post(`studio/projects/${project.id}/episodes/1/annotations`, {
    headers,
    data: { startOffset, endOffset: startOffset + quotedText.length, quotedText, note: '这里需要加强冲突感' },
  });
  if (!annotationResponse.ok()) throw new Error(`保存标注失败：${annotationResponse.status()}`);

  await inspect('episodes-desktop', { width: 1440, height: 1000 }, '.episode-sidebar');
  await inspect('episodes-mobile', { width: 390, height: 844 }, '.episode-sidebar');
  await inspectEpisodeInteractions();
  await deleteStoryInUi();
} catch (error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  await api.dispose();
}

console.log(JSON.stringify(report, null, 2));
if (report.status !== 'passed' || report.consoleErrors.length || report.pageErrors.length || report.failedResponses.length) process.exitCode = 1;
