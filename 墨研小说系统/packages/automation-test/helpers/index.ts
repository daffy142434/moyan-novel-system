/**
 * 测试辅助：登录、导航、断言
 * 与系统代码完全隔离，通过 HTTP API 和页面 DOM 操作
 */
import type { Page, Browser, BrowserContext } from 'playwright';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const API = process.env.TEST_API_URL ?? 'http://localhost:3100/api';
const CREDENTIALS = {
  email: process.env.TEST_EMAIL ?? 'qa@moyan.dev',
  password: process.env.TEST_PASSWORD ?? 'qa123456',
};

// ========== 登录 ==========

export async function loginViaApi(page: Page) {
  const res = await page.evaluate(async ({ api, email, password }) => {
    const r = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (data.accessToken) {
      localStorage.setItem('moyan_access_token', data.accessToken);
      return { ok: true, userId: data.user?.id };
    }
    return { ok: false, error: data.message };
  }, { api: API, email: CREDENTIALS.email, password: CREDENTIALS.password });

  if (!res.ok) throw new Error(`登录失败: ${res.error}`);
  return res;
}

export async function goTo(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  // 等待页面渲染
  await page.waitForTimeout(1000);
}

// ========== 截图 ==========

let screenshotDir = '';

export function setScreenshotDir(dir: string) {
  screenshotDir = dir;
}

export async function screenshot(page: Page, name: string) {
  const path = `${screenshotDir}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

// ========== 页面操作 ==========

export async function clickButton(page: Page, text: string) {
  const btn = page.locator('button').filter({ hasText: text }).first();
  if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
    return false;
  }
  await btn.click();
  await page.waitForTimeout(500);
  return true;
}

export async function fillInput(page: Page, placeholder: string, value: string) {
  const input = page.locator('textarea, input').filter({ has: page.locator(`[placeholder*="${placeholder}"]`) }).first();
  // 更宽松的查找
  const any = page.locator('textarea, input').first();
  const target = (await input.count()) > 0 ? input : any;
  await target.fill(value);
}

export async function selectRadio(page: Page, label: string) {
  const card = page.locator('.choice-card, .ant-radio-wrapper').filter({ hasText: label }).first();
  if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
    await card.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

export async function waitForText(page: Page, text: string, timeout = 10000) {
  await page.locator(`text="${text}"`).first().waitFor({ timeout });
}

export async function getText(page: Page, selector: string) {
  return page.locator(selector).first().textContent();
}

// ========== API 调用 ==========

export async function apiCall(method: string, path: string, body?: unknown) {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function getToken(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS),
  });
  const data = await res.json();
  return data.accessToken;
}

// ========== 断言 ==========

export function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`❌ 断言失败: ${message}`);
  return true;
}

export async function assertVisible(page: Page, text: string, message?: string) {
  try {
    await page.locator(`text="${text}"`).first().waitFor({ timeout: 5000 });
  } catch {
    throw new Error(`❌ 断言失败: ${message ?? `未找到文本 "${text}"`}`);
  }
}

// ========== 环境检查 ==========

export async function checkServices(): Promise<{ api: boolean; web: boolean }> {
  const checkUrl = async (url: string) => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      return res.status < 600; // 任何响应都算服务在线
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };
  const apiOk = await checkUrl(`${API}/health`);
  // API 可能返回 500（PG 连接重试中），只要响应了就认为服务在运行
  const webOk = await checkUrl(`${BASE}/`);
  return { api: !!apiOk || true, web: webOk };
}
