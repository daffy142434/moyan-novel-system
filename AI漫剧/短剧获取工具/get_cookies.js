/**
 * 抖音 Cookie 获取脚本 — 自动保存模式
 * 打开浏览器 → 等待用户登录 → 自动保存 Cookie
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
    const chromePath = findChrome();
    if (!chromePath) { console.error('未找到 Chrome'); process.exit(1); }

    // 使用持久化用户数据目录，下次启动时保留登录态
    const userDataDir = path.join(__dirname, '.chrome-data');
    fs.mkdirSync(userDataDir, { recursive: true });

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        userDataDir: userDataDir,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36');
    await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('\n========================================');
    console.log('  浏览器已打开！请在抖音页面登录');
    console.log('  登录成功后，等待 10 秒自动保存...');
    console.log('  或随时按 Ctrl+C 中断');
    console.log('========================================\n');

    // 等待用户登录 — 轮询检查是否有 sessionid cookie
    for (let i = 0; i < 120; i++) {  // 最多等 2 分钟
        await new Promise(r => setTimeout(r, 1000));
        const cookies = await page.cookies();
        const hasSession = cookies.some(c => c.name === 'sessionid');
        if (hasSession) {
            console.log('✅ 检测到登录成功！保存 Cookie...');
            await saveCookies(cookies);
            console.log('✅ 完成！可以关闭浏览器窗口了');
            break;
        }
        if (i === 10) console.log('  等待登录中... (打开手机抖音扫码更快)');
        if (i === 30) console.log('  仍在等待... (请用抖音APP扫码登录)');
        if (i === 60) console.log('  已等待 1 分钟...');
        if (i === 90) console.log('  已等待 1.5 分钟...');
        if (i === 119) console.log('⏰ 超时，请重新运行');
    }

    await browser.close();
    process.exit(0);
}

async function saveCookies(cookies) {
    let output = '# Netscape HTTP Cookie File\n';
    output += `# Generated at ${new Date().toISOString()}\n\n`;
    for (const c of cookies) {
        const domain = c.domain.startsWith('.') ? c.domain : '.' + c.domain;
        const expires = c.expires || Math.floor(Date.now() / 1000 + 86400 * 365);
        try {
            Buffer.from(c.value, 'latin1').toString('latin1');
            output += `${domain}\tTRUE\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${expires}\t${c.name}\t${c.value}\n`;
        } catch(e) {
            // skip cookies with non-latin1 values
        }
    }

    // 保存到多个位置
    const paths = [
        path.join(__dirname, 'cookies_puppeteer.txt'),
        path.join(__dirname, 'cookies.txt'),
    ];
    for (const p of paths) {
        fs.writeFileSync(p, output, 'utf-8');
        console.log(`  ✅ ${p}`);
    }

    const hasSession = cookies.some(c => c.name === 'sessionid');
    console.log(`  共 ${cookies.length} 个 Cookie${hasSession ? ' (含 sessionid 登录态)' : ''}`);
}

main().catch(e => { console.error('错误:', e.message); process.exit(1); });
