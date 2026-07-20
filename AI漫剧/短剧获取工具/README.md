# 📺 短剧获取工具

> 自动下载抖音/红果短剧全集
> 版本：v1.1.0 — 新增批量下载模式

---

## 安装

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 运行
python main.py --help
```

---

## 使用方式

### 1️⃣ 下载抖音合集

```bash
# 直接下载合集（最推荐）
python main.py https://www.douyin.com/collection/xxxxx

# 从分享短链接下载
python main.py https://v.douyin.com/xxxxx/
```

### 2️⃣ 从单集链接自动发现合集

```bash
# 工具会自动解析视频页面，查找所属合集
python main.py https://www.douyin.com/video/xxxxx
```

### 3️⃣ 批量下载（从文件读取多个链接）

```bash
# 从文件批量读取链接，每行一个
python main.py -f urls.txt

# 指定 Cookie
python main.py --cookies cookies.txt -f urls.txt
```

文件格式 (`urls.txt`)：
```
# 注释行（以 # 开头）和空行会被忽略
https://www.douyin.com/collection/7321234567890123456
https://www.douyin.com/video/7412345678901234567
https://v.douyin.com/xxxxxx/
```

批量执行完后会显示汇总报告：
```
📊 批量下载汇总
==================================================
   总计: 5
   ✅ 成功: 3
   ❌ 失败: 1
   ⏭️  跳过: 1
```

### 4️⃣ 预览合集内容

```bash
# 只看有哪些集，不下载
python main.py --list https://www.douyin.com/collection/xxxxx
```

### 5️⃣ 指定 Cookie

```bash
# 有些抖音视频需要登录才能下载
python main.py --cookies cookies.txt https://v.douyin.com/xxxxx/
```

### 6️⃣ 查看 Cookie 教程

```bash
python main.py --cookie-guide
```

---

## 如何获取 Cookie

1. 打开 Chrome 浏览器，登录抖音 [www.douyin.com](https://www.douyin.com)
2. 安装 Chrome 扩展 **Get cookies.txt** ([下载链接](https://chrome.google.com/webstore/detail/get-cookiestxt/bgaddhkoddajcdgocldbbfleckgcbcid))
3. 在抖音页面点击扩展图标 → **Export** → 保存为 `cookies.txt`
4. 把 `cookies.txt` 放到本工具目录下

---

## 目录结构

```
短剧获取工具/
├── main.py              # 主程序入口
├── config.py            # 配置
├── downloader.py        # 下载引擎（yt-dlp）
├── requirements.txt     # 依赖列表
├── cookies.txt          # Cookie文件（需自行导出）
├── urls.txt             # 批量下载链接列表（示例模板）
├── platforms/
│   ├── __init__.py
│   ├── douyin.py        # 抖音支持（合集发现+解析）
│   └── hongguo.py       # 红果短剧支持
└── downloads/           # 下载的视频存放目录
```

---

## 注意事项

- ⚠️ 视频版权归原作者所有，请仅用于个人学习
- ⚠️ 部分抖音合集需要登录（Cookie）才能下载
- ⚠️ 请合理使用，避免频繁请求导致账号受限
- ⚠️ 红果短剧目前推荐使用 [short-drama-downloader](https://github.com/lingbol088-spec/short-drama-downloader)

---

## 后期规划（阶段二）

- [ ] 📚 短剧目录爬取（分类+标题入库）
- [ ] 🔍 搜索功能
- [ ] 🌐 Web 管理界面
- [ ] 📊 下载进度管理
- [ ] 🔄 定时自动更新
