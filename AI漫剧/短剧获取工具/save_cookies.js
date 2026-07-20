/**
 * 抖音 Cookie 保存脚本 — 快速模式
 * 使用: node save_cookies.js
 *
 * 先打开浏览器让你登录，30秒后自动保存
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

function findChrome() {
    for (const p of [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    ]) { if (fs.existsSync(p)) return p; }
    return null;
}

async function main() {
    console.log('启动浏览器...');
    const browser = await puppeteer.launch({
        executablePath: findChrome(),
        headless: false,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36');
    await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('\n==============================');
    console.log('  请在打开的浏览器中登录抖音');
    console.log('  30秒后自动保存 Cookie');
    console.log('==============================\n');

    // 等30秒让用户登录
    for (let i = 30; i > 0; i--) {
        process.stdout.write(`\r  等待 ${i} 秒后自动保存...`);
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('\n\n正在保存 Cookie...');

    const cookies = await page.cookies();

    // 保存为 Netscape 格式
    let output = '# Netscape HTTP Cookie File\n';
    output += `# Generated at ${new Date().toISOString()}\n\n`;
    for (const c of cookies) {
        const domain = c.domain.startsWith('.') ? c.domain : '.' + c.domain;
        const expires = c.expires || Math.floor(Date.now() / 1000 + 86400 * 365);
        try {
            Buffer.from(c.value, 'latin1').toString('latin1');
            output += `${domain}\tTRUE\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${expires}\t${c.name}\t${c.value}\n`;
        } catch(e) {}
    }

    fs.writeFileSync('cookies_puppeteer.txt', output, 'utf-8');
    fs.writeFileSync('cookies.txt', output, 'utf-8');

    const has = cookies.some(c => c.name === 'sessionid');
    console.log(`保存了 ${cookies.length} 个 Cookie`);
    console.log(has ? '✅ 已登录状态' : '⚠️ 未检测到登录');

    await browser.close();
}

main().catch(e => console.error('错误:', e.message));
