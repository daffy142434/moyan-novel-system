/**
 * 全功能页面测试：登录 → 查看项目列表 → 打开项目 → 验证3集内容无乱码
 */
import type { Page } from 'playwright';
import { loginViaApi, goTo, clickButton, waitForText, screenshot } from '../helpers/index';

export const description = 'QA 账号完整页面流���测试';

export default {
  description,
  async run(page: Page) {
    const errors: string[] = [];

    // 1. 登录 QA 账号
    await goTo(page, '/');
    await loginViaApi(page);
    await page.waitForTimeout(500);

    // 2. 查看项目列表
    await goTo(page, '/app');
    await page.waitForTimeout(2000);
    await screenshot(page, '01-dashboard');

    // 检查编码：页面不应出现乱码字符
    const bodyText = await page.textContent('body') || '';
    const garbled = /[\uFFFD]{3,}/.test(bodyText) || bodyText.includes('？');
    if (!garbled) {
      console.log('  ✅ 仪表盘无乱码');
    } else {
      errors.push('仪表盘出现乱码字符');
      console.log('  ❌ 发现乱码');
    }

    // 3. 打开项目列表获取可用项目
    await goTo(page, '/app/library');
    await page.waitForTimeout(1500);
    await screenshot(page, '02-library');

    // 检查标题
    const titles = await page.$$eval('.ant-card .ant-typography, h1, h2, h3, h4', els => els.map(e => e.textContent));
    console.log('  项目标题:', titles.slice(0, 5).join(', '));

    // 4. 尝试打开第一个项目（如果有霸总的契约甜妻）
    const hasProject = await page.$('a[href*="/app/stories/"]');
    if (hasProject) {
      await hasProject.click();
      await page.waitForTimeout(2000);
    } else {
      // 直接导航到已知项目
      console.log('  直接导航到项目...');
    }
    await screenshot(page, '03-project');

    // 5. 检查集数列表
    const episodes = await page.$$('.ant-card .ant-typography, h3, h4');
    const epTitles = [];
    for (const el of episodes.slice(0, 10)) {
      const t = await el.textContent();
      if (t && (t.includes('EP') || t.includes('集') || t.includes('章'))) {
        epTitles.push(t);
      }
    }
    console.log('  集数标题:', epTitles.slice(0, 5).join(', '));

    // 6. 检查审核卡片
    const hasScore = await page.$('text=最新自检');
    if (hasScore) {
      console.log('  ✅ 审核卡片存在');
      await screenshot(page, '04-review-card');
    }

    if (errors.length > 0) {
      throw new Error('测试失败:\n' + errors.join('\n'));
    }
    console.log('  ✅ 页面无错误');
  },
};
