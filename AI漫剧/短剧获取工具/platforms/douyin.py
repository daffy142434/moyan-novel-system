"""
抖音平台支持
功能：
1. 从单集链接提取合集ID（合集/系列/短剧）
2. 构建合集下载链接
3. 判断URL类型
"""
import re
import json
import time
import requests
from urllib.parse import urlparse, parse_qs
from rich.console import Console

console = Console()

# 抖音 URL 模式
PATTERNS = {
    "video": re.compile(r"(?:https?://)?(?:www\.)?douyin\.com/video/(\d+)"),
    "collection": re.compile(r"(?:https?://)?(?:www\.)?douyin\.com/(?:collection|mix|series)/(\d+)"),
    "share": re.compile(r"(?:https?://)?v\.douyin\.com/(\w+)/?"),
    "user": re.compile(r"(?:https?://)?(?:www\.)?douyin\.com/user/(\w+)"),
}


def detect_url_type(url):
    """判断抖音链接类型"""
    for url_type, pattern in PATTERNS.items():
        if pattern.search(url):
            return url_type
    return "unknown"


def resolve_share_url(url):
    """解析抖音分享短链接（v.douyin.com/xxx）为完整链接

    注意：短链接可能重定向到 iesdouyin.com，需要提取视频ID并
    重建为标准 douyin.com/video/{id} 链接。
    """
    if "v.douyin.com" in url:
        try:
            resp = requests.get(url, allow_redirects=True, timeout=10,
                                headers={"User-Agent": "Mozilla/5.0"})
            final_url = resp.url

            # 如果跳转到了 iesdouyin.com/share/video/{id}，提取视频ID
            m = re.search(r"iesdouyin\.com/share/video/(\d+)", final_url)
            if m:
                video_id = m.group(1)
                return f"https://www.douyin.com/video/{video_id}"

            return final_url
        except Exception as e:
            console.print(f"[red]❌ 解析短链接失败: {e}[/red]")
            return url
    return url


def extract_video_id(url):
    """从视频链接提取视频ID"""
    m = PATTERNS["video"].search(url)
    if m:
        return m.group(1)
    return None


def extract_collection_id(url):
    """从合集链接提取合集ID"""
    m = PATTERNS["collection"].search(url)
    if m:
        return m.group(1)
    return None


def fetch_page_data(video_id, cookies=None):
    """
    获取抖音视频页面，提取内嵌数据

    返回: dict 或 None
    """
    url = f"https://www.douyin.com/video/{video_id}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.douyin.com/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }

    try:
        cj = _make_cookie_jar(cookies)
        resp = requests.get(url, headers=headers, timeout=15, cookies=cj)
        resp.encoding = "utf-8"
        html = resp.text

        # 方法1: 查找 __NEXT_DATA__ 或 __INITIAL_STATE__
        patterns = [
            r"window\.__NEXT_DATA__\s*=\s*(\{.*?\});",
            r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\});",
            r'<script id="__NEXT_DATA__"[^>]*>(\{.*?\})</script>',
        ]

        for p in patterns:
            m = re.search(p, html, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(1))
                except json.JSONDecodeError:
                    continue

        # 方法2: 查找 RENDER_DATA（抖音比较新的方式）
        m = re.search(
            r'<script[^>]*id="RENDER_DATA"[^>]*type="application/json"[^>]*>(.*?)</script>',
            html,
            re.DOTALL,
        )
        if m:
            try:
                raw = m.group(1)
                # RENDER_DATA 的 JSON 是 URL 编码过的
                from urllib.parse import unquote
                decoded = unquote(raw)
                return json.loads(decoded)
            except Exception:
                pass

        return None

    except requests.RequestException as e:
        console.print(f"[red]❌ 请求页面失败: {e}[/red]")
        return None


_API_BASE = "https://www.douyin.com/aweme/v1/web"


def _make_cookie_jar(cookies_dict=None):
    """将 cookies dict 转为 requests cookie jar，过滤非 latin-1 值"""
    import http.cookiejar, urllib.parse
    cj = http.cookiejar.CookieJar()
    if not cookies_dict:
        return cj
    for key, val in cookies_dict.items():
        # URL 解码后检查是否含非 latin-1 字符
        try:
            decoded = urllib.parse.unquote(str(val))
            decoded.encode("latin-1")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        ck = http.cookiejar.Cookie(
            version=0, name=key, value=val,
            port=None, port_specified=False,
            domain=".douyin.com", domain_specified=True, domain_initial_dot=True,
            path="/", path_specified=True,
            secure=True, expires=None,
            discard=False, comment=None, comment_url=None,
            rest={},
        )
        cj.set_cookie(ck)
    return cj


def _api_headers():
    """构造 API 请求头"""
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.douyin.com/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }


def fetch_video_detail(video_id, cookies_dict=None):
    """
    通过抖音 API 获取单集视频详情

    关键: 需要 aid=6383 参数，否则 API 返回空

    返回: dict (aweme_detail) 或 None
    """
    import requests as req
    url = f"{_API_BASE}/aweme/detail/?aweme_id={video_id}&aid=6383&device_platform=web"
    try:
        cj = _make_cookie_jar(cookies_dict)
        resp = req.get(url, headers=_api_headers(), cookies=cj, timeout=20)
        if resp.status_code == 200 and resp.content:
            data = resp.json()
            detail = data.get("aweme_detail")
            if detail:
                return detail
        return None
    except Exception as e:
        console.print(f"[red]❌ API 请求失败: {e}[/red]")
        return None


def fetch_collection_videos(mix_id, cookies_dict=None):
    """
    通过抖音 API 获取合集内所有视频

    返回: list of aweme_detail dicts
    """
    import requests as req
    all_awemes = []
    cursor = 0
    has_more = 1
    page = 0
    cj = _make_cookie_jar(cookies_dict)

    while has_more and page < 20:
        url = f"{_API_BASE}/mix/aweme/?mix_id={mix_id}&aid=6383&count=50&cursor={cursor}"
        try:
            resp = req.get(url, headers=_api_headers(), cookies=cj, timeout=20)
            if resp.status_code == 200 and resp.content:
                data = resp.json()
                aweme_list = data.get("aweme_list", [])
                if aweme_list:
                    all_awemes.extend(aweme_list)
                has_more = data.get("has_more", 0)
                cursor = data.get("cursor", 0)
                page += 1
            else:
                break
        except Exception as e:
            console.print(f"[red]❌ 获取合集列表失败: {e}[/red]")
            break

    return all_awemes


def get_collection_id_from_video(video_url, cookies_dict=None):
    """
    从单集视频链接中提取合集ID

    核心思路：
    1. 优先使用 API 获取视频详情（含 mix_info）
    2. 如果 API 失败，回退到解析页面 HTML

    返回: (collection_id, collection_title) 或 (None, None)
    """
    url = resolve_share_url(video_url)
    video_id = extract_video_id(url)

    if not video_id:
        console.print("[red]❌ 无法解析视频ID[/red]")
        return None, None

    console.print(f"[dim]🔍 视频ID: {video_id}[/dim]")
    console.print("[dim]🔍 正在通过API获取视频详情...[/dim]")

    # 方法1: 使用 API（可以获取 mix_info）
    detail = fetch_video_detail(video_id, cookies_dict)
    if detail:
        mix_info = detail.get("mix_info") or {}
        if mix_info:
            cid = mix_info.get("mix_id") or mix_info.get("mixId")
            ctitle = mix_info.get("mix_name") or mix_info.get("mixName", "未命名合集")
            if cid:
                console.print(f"[green]✅ 发现合集: {ctitle} (ID: {cid})[/green]")
                return cid, ctitle
        console.print("[yellow]⚠️ 该视频不属于任何合集[/yellow]")
        return None, None

    # 方法2: 回退到解析页面 HTML
    console.print("[dim]🔍 API 未返回合集信息，尝试解析页面...[/dim]")
    data = fetch_page_data(video_id, cookies_dict)

    if data is None:
        console.print("[yellow]⚠️ 无法获取页面数据[/yellow]")
        return None, None

    # 在 RENDER_DATA 中搜索合集信息
    collection_id = None
    collection_title = None
    try:
        json_str = json.dumps(data)
        m = re.search(r'"mixId"\s*:\s*"(\d+)"', json_str)
        if m:
            collection_id = m.group(1)
        m2 = re.search(r'"mixName"\s*:\s*"([^"]+)"', json_str)
        if m2:
            collection_title = m2.group(1)
    except Exception:
        pass

    if collection_id:
        console.print(f"[green]✅ 发现合集: {collection_title or '未命名'} (ID: {collection_id})[/green]")
        return collection_id, collection_title

    console.print("[yellow]⚠️ 未在页面中找到合集信息，该视频可能不属于任何合集[/yellow]")
    return None, None


def build_collection_url(collection_id):
    """构建合集链接"""
    return f"https://www.douyin.com/collection/{collection_id}"


def prompt_for_cookie_file():
    """提示用户导出Cookie"""
    console.print("""
[yellow]📝 抖音需要Cookie才能下载视频，请按以下步骤操作：[/yellow]

1. 在Chrome中登录抖音 [link=https://www.douyin.com]www.douyin.com[/link]
2. 安装 Get cookies.txt 扩展（Chrome应用商店搜索）
3. 在抖音页面点击扩展图标 → Export → 保存为 cookies.txt
4. 将 cookies.txt 放到本工具目录下
""")
