"""
红果短剧平台支持

红果短剧目前主要是 APP，没有稳定的 Web 前端。
本模块使用方案：
1. 如果用户提供 hgshort.com 网页链接 → 尝试用 yt-dlp 直接下载
2. 如果用户提供短剧ID → 尝试通过公开接口获取信息
3. 兜底：引导用户使用 short-drama-downloader 工具
"""
import re
import requests
from urllib.parse import urlparse, parse_qs
from rich.console import Console

console = Console()

# URL 模式
PATTERNS = {
    "drama": re.compile(r"(?:https?://)?(?:www\.)?hgshort\.com/drama/(\w+)"),
    "video": re.compile(r"(?:https?://)?(?:www\.)?hgshort\.com/video/(\w+)"),
    "share": re.compile(r"(?:https?://)?(?:www\.)?hgshort\.com/s/(\w+)"),
}


def detect_url_type(url):
    """判断红果短剧链接类型"""
    for url_type, pattern in PATTERNS.items():
        if pattern.search(url):
            return url_type
    return "unknown"


def get_drama_id_from_url(url):
    """从URL提取短剧ID"""
    for url_type, pattern in PATTERNS.items():
        m = pattern.search(url)
        if m:
            return m.group(1), url_type
    return None, None


def fetch_drama_info(drama_id):
    """
    获取短剧基本信息（占位，待完善）

    红果短剧目前没有公开的 Web API，
    需要通过抓包 APP 获取，这部分后续补充。
    """
    console.print("[yellow]⚠️ 红果短剧的自动信息获取正在开发中[/yellow]")
    console.print("[yellow]💡 目前推荐直接使用 short-drama-downloader 工具下载红果短剧[/yellow]")
    return None


def show_alternative_tool():
    """引导用户使用 short-drama-downloader"""
    console.print("""
[bold yellow]📌 红果短剧下载推荐方案[/bold yellow]

目前有一个开源工具 [bold]short-drama-downloader[/bold] 专门支持红果短剧下载：

[link=https://github.com/lingbol088-spec/short-drama-downloader]
  https://github.com/lingbol088-spec/short-drama-downloader
[/link]

功能特点：
  ✅ 搜索红果短剧（关键词搜索）
  ✅ 批量下载全集
  ✅ 导入短剧ID下载
  ✅ 支持红果短剧、红果漫剧、爱奇艺短剧等多个平台

使用方法：
  1. 下载项目 Release 中的 exe
  2. 搜索或粘贴短剧ID
  3. 一键下载

[yellow]后续本工具会集成该功能，敬请期待。[/yellow]
""")
