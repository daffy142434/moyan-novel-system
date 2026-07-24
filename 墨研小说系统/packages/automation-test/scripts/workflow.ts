/**
 * 页面编码检查：遍历所有页面，确认无乱码
 */
import type { Page } from 'playwright';
import { loginViaApi, goTo, screenshot } from '../helpers/index';

export const description = '全页面编码检查';

export default {
  description,
  async run(page: Page) {
    await goTo(page, '/');
    await loginViaApi(page);
    await page.waitForTimeout(1000);

    const pages: { path: string; expectText: string }[] = [
      { path: '/app', expectText: '墨研' },
      { path: '/app/workbench', expectText: '剧本' },
      { path: '/app/library', expectText: '作品' },
      { path: '/app/review', expectText: '审核' },
      { path: '/app/membership', expectText: '会员' },
      { path: '/app/debug', expectText: 'Prompt' },
    ];

    let allOk = true;
    for (const p of pages) {
      await goTo(page, p.path);
      const title = await page.title();
      const bodyText = await page.textContent('body') || '';
      // 检测编码损坏：Unicode 替换字符(U+FFFD) 或连续乱码模式
      const hasGarbled = bodyText.includes('\uFFFD\uFFFD') || bodyText.includes('\uFFFD\uFFFD\uFFFD');

      if (hasGarbled) {
        console.log(`  ❌ ${p.path} - 发现乱码`);
        allOk = false;
      } else {
        console.log(`  ✅ ${p.path} - ${title}`);
      }
      await screenshot(page, 'page-' + p.path.replace(/\//g, '-').replace(/^-/, ''));
    }

    if (!allOk) throw new Error('页面存在编码问题');
    console.log('  ✅ 所有页面编码正常');
  },
};
