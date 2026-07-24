/**
 * 自定义测试脚本模板
 *
 * 复制此文件到 custom/ 目录，修改 run 函数即可。
 * 会自动被 runner 发现并执行。
 *
 * 可用工具（从 ../helpers/index 导入）:
 *   loginViaApi(page)       - 通过 API 登录
 *   goTo(page, '/path')     - 导航到页面
 *   clickButton(page, '文本') - 点击按钮
 *   selectRadio(page, '标签') - 选择单选项
 *   fillInput(page, 'placeholder', '值') - 填写输入框
 *   waitForText(page, '文本', timeout?) - 等待文本出现
 *   screenshot(page, 'name') - 截图
 *   assertVisible(page, '文本') - 断言文本可见
 *   apiCall('GET', '/path', body?) - API 调用
 */

import type { Page } from 'playwright';
import {
  loginViaApi, goTo, clickButton, screenshot,
} from '../helpers/index';

export const description = '自定义脚本示例：打开首页截图';

export default {
  description,
  async run(page: Page) {
    // 1. 打开首页并登录
    await goTo(page, '/');
    await loginViaApi(page);

    // 2. 导航到目标页面
    await goTo(page, '/app');

    // 3. 执行操作
    // await clickButton(page, '某个按钮');

    // 4. 截图保存
    await screenshot(page, 'custom-screenshot');
  },
};
