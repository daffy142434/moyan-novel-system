"""
下载核心 — 基于 yt-dlp 的封装
"""
import os
import re
import sys
import yt_dlp
from rich.console import Console
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    DownloadColumn,
    TransferSpeedColumn,
    TimeRemainingColumn,
)

console = Console()


class DownloadLogger:
    """yt-dlp 日志回调"""
    def __init__(self, verbose=False):
        self.verbose = verbose

    def debug(self, msg):
        if self.verbose:
            console.print(f"[dim]{msg}[/dim]")

    def info(self, msg):
        if self.verbose:
            console.print(f"[blue]{msg}[/blue]")

    def warning(self, msg):
        console.print(f"[yellow][!] {msg}[/yellow]")

    def error(self, msg):
        if "ERROR" in msg:
            console.print(f"[red][X] {msg}[/red]")


def _progress_hook(d):
    """yt-dlp 进度回调"""
    if d["status"] == "downloading":
        # 由 rich 的进度条处理显示
        pass
    elif d["status"] == "finished":
        console.print(f"  [OK] 已下载: [green]{os.path.basename(d['filename'])}[/green]")


def get_ydl_opts(output_dir, cookies=None, verbose=False):
    """获取 yt-dlp 选项"""
    opts = {
        "outtmpl": os.path.join(output_dir, "%(playlist_title|Unknown)s", "%(playlist_index)02d_%(title)s.%(ext)s"),
        "format": "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "merge_output_format": "mp4",
        "ignoreerrors": True,
        "no_warnings": not verbose,
        "logger": DownloadLogger(verbose=verbose),
        "progress_hooks": [_progress_hook],
        "extract_flat": False,
        "retries": 5,
        "fragment_retries": 5,
        "continuedl": True,       # 断点续传
        "concurrent_fragments": 3, # 多线程下载片段
    }

    if cookies and os.path.exists(cookies):
        opts["cookiefile"] = cookies
        console.print(f"[dim].. 使用Cookie文件: {cookies}[/dim]")

    return opts


def download_url(url, output_dir, cookies=None, verbose=False):
    """
    用 yt-dlp 下载 URL

    返回:
        success (bool), message (str)
    """
    opts = get_ydl_opts(output_dir, cookies, verbose)

    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    try:
        console.print(f"\n[bold blue][下载] 开始抓取:[/bold blue] {url}")
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

            if info is None:
                return False, "无法解析链接，可能需要Cookie或链接已失效"

            # 合集下载统计
            if "entries" in info:
                total = len([e for e in info["entries"] if e is not None])
                success_count = sum(
                    1 for e in info["entries"] if e is not None and "requested_downloads" in e
                )
                title = info.get("title", "未命名合集")
                console.print(f"\n[bold green][OK] 合集下载完成![/bold green]")
                console.print(f"   剧名: {title}")
                console.print(f"   集数: {total}")
                return True, f"合集 '{title}' 共 {total} 集下载完成"
            else:
                title = info.get("title", "未命名")
                console.print(f"\n[bold green][OK] 单集下载完成: {title}[/bold green]")
                return True, f"'{title}' 下载完成"

    except yt_dlp.utils.DownloadError as e:
        err_msg = str(e)
        if "HTTP Error 403" in err_msg:
            return False, "访问被拒绝（403），需要Cookie。请参考 README 导出抖音Cookie"
        elif "HTTP Error 404" in err_msg:
            return False, "链接不存在（404），请检查链接是否正确"
        elif "This video is private" in err_msg:
            return False, "该视频已设置为私密，无法下载"
        elif "No video formats found" in err_msg:
            return False, "未找到可用视频格式，可能需要Cookie"
        else:
            return False, f"下载出错: {err_msg[:200]}"

    except Exception as e:
        return False, f"未知错误: {str(e)[:200]}"


def list_collection(url, cookies=None, verbose=False):
    """
    列出合集（不下载）

    返回:
        (title, entries_list) or (None, [])
    """
    opts = {
        "extract_flat": True,
        "quiet": not verbose,
        "no_warnings": not verbose,
        "ignoreerrors": True,
        "force_generic_extractor": False,
        "logger": DownloadLogger(verbose=verbose),
    }
    if cookies and os.path.exists(cookies):
        opts["cookiefile"] = cookies

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info is None:
                return None, []

            if "entries" in info:
                entries = []
                for i, e in enumerate(info["entries"], 1):
                    if e:
                        entries.append({
                            "index": i,
                            "title": e.get("title", f"第{i}集"),
                            "url": e.get("url") or e.get("webpage_url", ""),
                            "duration": e.get("duration", 0),
                        })
                return info.get("title", "合集"), entries
            else:
                return None, [{"index": 1, "title": info.get("title", "单集"), "url": url}]
    except Exception as e:
        console.print(f"[red][X] 获取列表失败: {e}[/red]")
        return None, []
