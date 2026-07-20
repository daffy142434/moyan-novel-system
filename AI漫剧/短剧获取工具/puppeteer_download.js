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
    const url = process.argv[2] || 'https://www.douyin.com/video/7650473555259297058';
    console.log('启动浏览器并访问:', url);

    const browser = await puppeteer.launch({
        executablePath: findChrome(),
        headless: false,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36');

    // 拦截网络请求，捕获视频 URL
    const videoUrls = new Set();
    await page.setRequestInterception(true);
    page.on('request', req => {
        const u = req.url();
        if (u.includes('.mp4') || u.includes('video') || u.includes('play')) {
            videoUrls.add(u);
        }
        req.continue();
    });
    page.on('response', async resp => {
        const u = resp.url();
        if (u.includes('aweme/v1/web/aweme/detail')) {
            try {
                const json = await resp.json();
                const detail = json.aweme_detail;
                if (detail) {
                    console.log('✅ API 返回数据!');
                    const play = detail.video?.play_addr;
                    if (play) {
                        console.log('播放地址:', JSON.stringify(play.url_list));
                    }
                }
            } catch(e) {}
        }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('页面加载完成');

    // 等待视频元素出现
    try {
        await page.waitForSelector('video', { timeout: 15000 });
        const videoSrc = await page.evaluate(() => {
            const v = document.querySelector('video');
            return v ? v.src : null;
        });
        console.log('Video src:', videoSrc);
    } catch(e) {
        console.log('Video element not found');
    }

    console.log('\n视频相关 URL:', [...videoUrls].filter(u => u.includes('mp4') || u.includes('douyinvod')).slice(0, 5));

    await browser.close();
}

main().catch(e => console.error(e.message));
