"""
 短剧获取工具 — CLI 入口

功能：
1. 抖音短剧合集下载（支持从单集自动发现合集）
2. 红果短剧下载（引导使用 short-drama-downloader）
3. 合集预览（查看合集内所有集）
4. 批量下载（从文件读取多个链接）
5. Cookie 管理

用法：
  # 下载合集（自动识别平台）
  python main.py https://www.douyin.com/collection/xxxxx

  # 从单集链接自动发现合集并下载
  python main.py https://www.douyin.com/video/xxxxx

  # 批量下载（从文件读取链接）
  python main.py -f urls.txt

  # 预览合集内容（不下载）
  python main.py --list https://www.douyin.com/collection/xxxxx

  # 指定Cookie文件
  python main.py --cookies cookies.txt https://v.douyin.com/xxxxx/
"""
import os
import sys
import re
import copy
import argparse
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

# 添加项目根目录到 sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_config, COOKIE_FILE
from downloader import download_url, list_collection
from platforms import douyin, hongguo

console = Console()
VERSION = "1.1.0"


def print_banner():
    """打印工具标题"""
    banner = """
[bold cyan]┌─────────────────────────────────────────┐
│         短剧获取工具 v{}             │
│      抖音 | 红果短剧 | 一键下载全集      │
│      批量模式 | -f urls.txt              │
└─────────────────────────────────────────┘[/bold cyan]
""".format(VERSION)
    console.print(banner)


def parse_platform(url):
    """
    判断链接属于哪个平台

    返回: platform_name (douyin/hongguo/unknown)
    """
    from config import PLATFORMS

    url_lower = url.lower()

    for platform, info in PLATFORMS.items():
        for domain in info["domains"]:
            if domain in url_lower:
                return platform

    return "unknown"


def handle_douyin(url, args):
    """处理抖音链接"""
    # 先解析短链接
    resolved = douyin.resolve_share_url(url)
    if resolved != url:
        console.print(f"[dim]-> 解析短链接: {resolved}[/dim]")
        url = resolved

    url_type = douyin.detect_url_type(url)

    # 情况1: 直接是合集链接
    if url_type in ("collection",):
        col_id = douyin.extract_collection_id(url)
        if not col_id:
            console.print("[red][X] 无法解析合集ID[/red]")
            return 1

        if args.list:
            # 仅预览
            title, entries = list_collection(url, args.cookies, args.verbose)
            if entries:
                console.print(f"\n[bold]列表 合集: {title}[/bold]")
                console.print(f"   共 {len(entries)} 集\n")
                table = Table(show_header=True, header_style="bold cyan")
                table.add_column("#", style="dim")
                table.add_column("标题")
                table.add_column("时长")
                for e in entries:
                    dur = f"{e['duration']}s" if e["duration"] else "?"
                    table.add_column_section()
                    table.add_row(str(e["index"]), e["title"][:60], dur)
                console.print(table)
            return 0

        # 下载
        output_dir = os.path.join(args.output, f"douyin_collection_{col_id}")
        success, msg = download_url(url, output_dir, args.cookies, args.verbose)
        console.print(f"\n[bold]{'[OK]' if success else '[X]'} {msg}[/bold]")
        return 0 if success else 1

    # 情况2: 单集链接，尝试发现合集
    if url_type in ("video", "share"):
        # 先尝试加载Cookie
        cookies_dict = None
        if args.cookies and os.path.exists(args.cookies):
            try:
                from http.cookiejar import MozillaCookieJar
                cj = MozillaCookieJar(args.cookies)
                cj.load()
                cookies_dict = {}
                for c in cj:
                    cookies_dict[c.name] = c.value
            except Exception:
                pass

        col_id, col_title = douyin.get_collection_id_from_video(url, cookies_dict)

        if col_id:
            col_url = douyin.build_collection_url(col_id)
            console.print(f"[green]-> 合集链接: {col_url}[/green]")

            output_dir = os.path.join(args.output, f"douyin_{col_id}")
            if col_title:
                output_dir = os.path.join(args.output, _safe_filename(col_title))

            success, msg = download_url(col_url, output_dir, args.cookies, args.verbose)
            console.print(f"\n[bold]{'[OK]' if success else '[X]'} {msg}[/bold]")
            return 0 if success else 1
        else:
            # 没找到合集 — 批量模式下自动下载单集，非批量则询问
            if getattr(args, "batch_mode", False):
                console.print("[yellow]未找到合集，将下载单集[/yellow]")
                output_dir = os.path.join(args.output, "single_videos")
                success, msg = download_url(url, output_dir, args.cookies, args.verbose)
                console.print(f"\n[bold]{'[OK]' if success else '[X]'} {msg}[/bold]")
                return 0 if success else 1

            console.print("[yellow]未找到合集信息。是否只下载当前单集? (y/n)[/yellow]")
            choice = input("> ").strip().lower()
            if choice in ("y", "yes", ""):
                output_dir = os.path.join(args.output, "single_videos")
                success, msg = download_url(url, output_dir, args.cookies, args.verbose)
                console.print(f"\n[bold]{'[OK]' if success else '[X]'} {msg}[/bold]")
                return 0 if success else 1
            else:
                console.print("[yellow]已取消下载[/yellow]")
                console.print("\n[bold][提示] 建议手动查找合集链接并重新运行:[/bold]")
                console.print("   打开抖音APP -> 进入作者主页 -> 找到合集 -> 复制链接")
                return 1

    console.print(f"[red][X] 不支持的抖音链接格式: {url}[/red]")
    console.print("[yellow]支持的格式:[/yellow]")
    console.print("  https://www.douyin.com/video/xxxxx  (单集)")
    console.print("  https://www.douyin.com/collection/xxxxx  (合集)")
    console.print("  https://v.douyin.com/xxxxx/  (分享短链)")
    return 1


def handle_hongguo(url, args):
    """处理红果短剧链接"""
    url_type = hongguo.detect_url_type(url)

    if url_type in ("drama", "video"):
        # 尝试用 yt-dlp 直接下载
        if args.list:
            title, entries = list_collection(url, args.cookies, args.verbose)
            if entries:
                console.print(f"\n[bold]列表 {title or '短剧'}[/bold]")
                console.print(f"   共 {len(entries)} 集")
            else:
                console.print("[yellow]未能获取列表[/yellow]")
            return 0

        console.print("[yellow][!] 红果短剧 Web 链接可能无法直接下载[/yellow]")
        console.print("[yellow]尝试用 yt-dlp 下载...[/yellow]")

        output_dir = os.path.join(args.output, "hongguo")
        success, msg = download_url(url, output_dir, args.cookies, args.verbose)
        if success:
            return 0

    # 不支持的链接或下载失败，引导到 short-drama-downloader
    hongguo.show_alternative_tool()
    return 1


def _safe_filename(name):
    """清理文件名中的非法字符"""
    return re.sub(r'[\\/*?:"<>|]', "_", name.strip())[:100]


# 从文本中提取抖音/红果链接的正则
URL_PATTERNS = [
    re.compile(r"https?://v\.douyin\.com/[\w-]+/?"),
    re.compile(r"https?://(?:www\.)?douyin\.com/(?:video|collection|mix|series)/\d+"),
    re.compile(r"https?://(?:www\.)?hongguo\.com/\S+"),
    re.compile(r"https?://hgshort\.com/\S+"),
]


def _extract_urls_from_line(line):
    """从一行文本中提取出所有抖音/红果链接"""
    found = []
    for pattern in URL_PATTERNS:
        for m in pattern.finditer(line):
            url = m.group(0).rstrip("/")
            if url not in found:
                found.append(url)
    return found


def batch_process_file(file_path, args):
    """
    从文件批量读取链接并逐个处理

    文件格式：每行一个链接（纯链接，或带描述文字+链接均可），
    空行和 # 开头的行会被忽略。
    示例:
        # 抖音合集
        https://www.douyin.com/collection/123456
        4.38 复制此链接... https://v.douyin.com/xxxxx/ 打开Dou音搜索
    """
    if not os.path.exists(file_path):
        console.print(f"[red][X] 文件不存在: {file_path}[/red]")
        return 1

    # 读取并解析链接
    urls = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # 从行中提取 URL（支持纯链接行和带描述的行）
            extracted = _extract_urls_from_line(line)
            urls.extend(extracted)

    if not urls:
        console.print(f"[yellow]⚠️ 文件中没有找到有效的链接 (空行和 # 注释行不计入)[/yellow]")
        return 0

    # 去重（保留顺序）
    seen = set()
    unique_urls = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique_urls.append(u)
    urls = unique_urls

    console.print(f"\n[bold cyan]📂 批量模式: 从文件读取到 {len(urls)} 个链接[/bold cyan]")
    console.print(f"   [dim]文件路径: {file_path}[/dim]")
    for u in urls:
        console.print(f"   [dim]  • {u}[/dim]")
    console.print()

    # 逐条处理
    stats = {"success": 0, "fail": 0, "skipped": 0, "total": len(urls)}

    for i, url in enumerate(urls, 1):
        console.print(f"\n[bold cyan]─── [{i}/{len(urls)}] 处理链接 ───[/bold cyan]")
        console.print(f"[dim]{url}[/dim]")

        # 解析平台
        platform = parse_platform(url)

        if platform == "unknown":
            console.print(f"[yellow]  ⚠️ 不支持的平台或链接格式，跳过[/yellow]")
            stats["skipped"] += 1
            continue

        console.print(f"[bold]平台:[/bold] {platform}")

        # 构建单条 args（复制 args，覆盖 url，标记批量模式）
        item_args = copy.copy(args)
        item_args.url = url
        item_args.batch_mode = True

        try:
            if platform == "douyin":
                result = handle_douyin(url, item_args)
            elif platform == "hongguo":
                result = handle_hongguo(url, item_args)
            else:
                result = 1

            if result == 0:
                stats["success"] += 1
            else:
                stats["fail"] += 1
        except KeyboardInterrupt:
            console.print(f"\n[yellow]⚠️ 用户中断，跳过剩余链接[/yellow]")
            stats["skipped"] += len(urls) - i + 1
            break
        except Exception as e:
            console.print(f"[red][X] 处理异常: {e}[/red]")
            stats["fail"] += 1

    # 汇总报告
    console.print(f"\n{'='*50}")
    console.print(f"[bold]📊 批量下载汇总[/bold]")
    console.print(f"{'='*50}")
    console.print(f"   总计: {stats['total']}")
    console.print(f"   ✅ 成功: [green]{stats['success']}[/green]")
    if stats["fail"]:
        console.print(f"   ❌ 失败: [red]{stats['fail']}[/red]")
    if stats["skipped"]:
        console.print(f"   ⏭️  跳过: [yellow]{stats['skipped']}[/yellow]")

    if stats["fail"] == 0 and stats["skipped"] == 0:
        console.print(f"\n[bold green]🎉 全部下载完成![/bold green]")
        return 0
    elif stats["fail"] > 0 and stats["success"] == 0:
        console.print(f"\n[red]全部失败或跳过，请检查链接和网络[/red]")
        return 1
    else:
        console.print(f"\n[yellow]部分完成 ({stats['success']}/{stats['total']})[/yellow]")
        return 0 if stats["success"] > 0 else 1


def main():
    print_banner()

    parser = argparse.ArgumentParser(
        description="短剧获取工具 — 自动下载抖音/红果短剧全集",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  %(prog)s https://www.douyin.com/collection/123456
  %(prog)s https://www.douyin.com/video/123456
  %(prog)s -f urls.txt
  %(prog)s --list https://www.douyin.com/collection/123456
  %(prog)s --cookies cookies.txt https://v.douyin.com/xxxxx/
        """,
    )

    parser.add_argument("url", nargs="?", help="短剧链接（合集链接/单集链接/分享链接）")
    parser.add_argument("-o", "--output", default=get_config()["output_dir"],
                        help=f"下载目录 (默认: {get_config()['output_dir']})")
    parser.add_argument("--cookies", default=COOKIE_FILE,
                        help=f"Cookie文件路径 (默认: {COOKIE_FILE})")
    parser.add_argument("--list", action="store_true",
                        help="预览合集内容（不下载）")
    parser.add_argument("-f", "--file",
                        help="从文件批量读取链接，每行一个（支持 # 注释行）")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="显示详细日志")
    parser.add_argument("--cookie-guide", action="store_true",
                        help="显示Cookie获取教程")

    args = parser.parse_args()

    # Cookie 教程
    if args.cookie_guide:
        douyin.prompt_for_cookie_file()
        return 0

    # 批量模式（优先）
    if args.file:
        return batch_process_file(args.file, args)

    # 检查是否有URL
    if not args.url:
        console.print(Panel.fit(
            "[bold yellow]请输入短剧链接[/bold yellow]\n\n"
            "[bold]使用方式:[/bold]\n"
            f"  python main.py [link=https://www.douyin.com/collection/xxxxx]https://www.douyin.com/collection/xxxxx[/link]\n"
            f"  python main.py -f [link=urls.txt]urls.txt[/link]  (批量模式)\n"
            f"  python main.py --list [link=https://www.douyin.com/collection/xxxxx]https://www.douyin.com/collection/xxxxx[/link]\n"
            f"  python main.py --cookie-guide  (获取Cookie教程)\n\n"
            "[dim]支持：抖音合集/单集/分享链接、红果短剧链接[/dim]\n"
            "[dim]批量模式：-f urls.txt，每行一个链接，# 开头的行自动忽略[/dim]",
            title=" 短剧获取工具",
            border_style="cyan",
        ))
        return 1

    # 解析平台
    platform = parse_platform(args.url)
    console.print(f"[bold]平台:[/bold] {platform}")

    # 根据平台处理
    if platform == "douyin":
        return handle_douyin(args.url, args)
    elif platform == "hongguo":
        return handle_hongguo(args.url, args)
    else:
        console.print(f"[red][X] 不支持的平台或链接格式[/red]")
        console.print("[yellow]当前支持: 抖音 (douyin.com)、红果短剧 (hgshort.com)[/yellow]")
        console.print("[yellow][提示] 如果是抖音分享链接 (v.douyin.com/xxx)，本工具可以解析[/yellow]")
        return 1


if __name__ == "__main__":
    sys.exit(main())
