# TikTok Downloader

TikTok 视频下载工具。

基于 `yt-dlp`，支持下载单条视频、直播、用户主页作品等。

## 使用

```bash
# 下载单条视频
yt-dlp https://vm.tiktok.com/xxxxxx

# 指定输出路径
yt-dlp -o "下载/%(title)s.%(ext)s" https://vm.tiktok.com/xxxxxx
```

## 项目状态

可行性验证完成，等待产品需求文档。
