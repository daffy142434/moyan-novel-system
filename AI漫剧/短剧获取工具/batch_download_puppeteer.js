/**
 * 抖音视频批量下载器 — 使用 Puppeteer 提取视频地址
 *
 * 使用: node batch_download_puppeteer.js
 * 从 urls.txt 读取链接，逐个下载到 downloads/ 目录
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

function findChrome() {
    for (const p of [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    ]) { if (fs.existsSync(p)) return p; }
    return null;
}

// 读取 urls.txt 提取链接
function readUrls(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const urls = [];
    const urlPattern = /https?:\/\/(?:www\.)?(?:v\.)?douyin\.com\/(?:video|collection|note)\/\S+/g;
    const shortPattern = /https?:\/\/v\.douyin\.com\/[\w-]+\/?/g;

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const found = trimmed.match(urlPattern) || trimmed.match(shortPattern);
        if (found) urls.push(found[0].replace(/\/$/, ''));
    }
    return [...new Set(urls)];
}

// 下载文件
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, { headers: { 'Referer': 'https://www.douyin.com/' } }, (resp) => {
            // 处理重定向
            if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                file.close();
                fs.unlinkSync(destPath);
                return downloadFile(resp.headers.location, destPath).then(resolve).catch(reject);
            }
            if (resp.statusCode !== 200) {
                file.close();
                fs.unlinkSync(destPath);
                return reject(new Error(`HTTP ${resp.statusCode}`));
            }
            const total = parseInt(resp.headers['content-length'] || '0');
            let downloaded = 0;
            resp.on('data', (chunk) => {
                downloaded += chunk.length;
                if (total) {
                    const pct = (downloaded / total * 100).toFixed(0);
                    process.stdout.write(`\r  ⬇️  下载中 ${pct}% (${(downloaded/1024/1024).toFixed(1)}MB / ${(total/1024/1024).toFixed(1)}MB)`);
                }
            });
            resp.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(); // new line after progress
                resolve(destPath);
            });
        }).on('error', (err) => {
            file.close();
            fs.unlinkSync(destPath);
            reject(err);
        });
    });
}

async function getVideoUrl(page, douyinUrl) {
    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('获取视频地址超时')), 30000);

        // 监听 API 响应
        page.on('response', async (resp) => {
            const u = resp.url();
            if (u.includes('aweme/v1/web/aweme/detail') || u.includes('aweme/v1/web/mix/aweme')) {
                try {
                    const json = await resp.json();
                    let detail = json.aweme_detail;
                    if (!detail && json.aweme_list?.length > 0) {
                        detail = json.aweme_list[0];
                    }
                    if (detail) {
                        const playAddr = detail.video?.play_addr;
                        if (playAddr?.url_list?.length > 0) {
                            // 选择无水印地址 (第一个)
                            const videoUrl = playAddr.url_list[0];
                            clearTimeout(timeout);
                            resolve(videoUrl);
                        }
                    }
                } catch (e) {}
            }
        });

        try {
            await page.goto(douyinUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        } catch(e) {
            // navigation might timeout but API response may already be captured
        }
    });
}

async function main() {
    console.log('========================================');
    console.log('  抖音批量下载器 (Puppeteer)');
    console.log('========================================\n');

    const chromePath = findChrome();
    if (!chromePath) { console.error('未找到 Chrome'); process.exit(1); }

    const urls = readUrls(path.join(__dirname, 'urls.txt'));
    if (urls.length === 0) { console.error('urls.txt 中没有找到有效链接'); process.exit(1); }

    console.log(`找到 ${urls.length} 个链接\n`);

    // 启动浏览器（无头模式可提高速度）
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const outputDir = path.join(__dirname, 'downloads', 'douyin_batch');
    fs.mkdirSync(outputDir, { recursive: true });

    const stats = { success: 0, fail: 0, total: urls.length };

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n─── [${i+1}/${urls.length}] 处理 ───`);
        console.log(`   ${url}`);

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36');

        try {
            console.log('  正在获取视频地址...');

            // 先解析短链接
            let targetUrl = url;
            if (url.includes('v.douyin.com')) {
                try {
                    const navPage = await browser.newPage();
                    await navPage.setUserAgent('Mozilla/5.0');
                    const resp = await navPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    targetUrl = navPage.url();
                    await navPage.close();
                    console.log(`  -> ${targetUrl}`);
                } catch (e) {}
            }

            const videoUrl = await getVideoUrl(page, targetUrl);
            if (!videoUrl) {
                console.log('  ⚠️ 未获取到视频地址');
                stats.fail++;
                await page.close();
                continue;
            }

            console.log(`  ✅ 获取到视频地址`);

            // 生成文件名
            const timestamp = Date.now();
            const fileName = `douyin_${i+1}_${timestamp}.mp4`;
            const filePath = path.join(outputDir, fileName);

            console.log('  开始下载...');
            await downloadFile(videoUrl, filePath);
            const fileSize = fs.statSync(filePath).size;
            console.log(`  ✅ 下载完成! (${(fileSize/1024/1024).toFixed(1)}MB)`);

            stats.success++;
        } catch (e) {
            console.log(`  ❌ 失败: ${e.message}`);
            stats.fail++;
        }

        await page.close();
    }

    await browser.close();

    console.log(`\n${'='.repeat(45)}`);
    console.log(`📊 批量下载完成`);
    console.log(`${'='.repeat(45)}`);
    console.log(`  总计: ${stats.total}`);
    console.log(`  ✅ 成功: ${stats.success}`);
    console.log(`  ❌ 失败: ${stats.fail}`);
    console.log(`  保存到: ${outputDir}`);
}

main().catch(e => console.error('错误:', e.message));
