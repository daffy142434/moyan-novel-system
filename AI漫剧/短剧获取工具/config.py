"""
配置管理
"""
import os
import json
from pathlib import Path

# 默认下载目录（同目录下的 downloads 文件夹）
DEFAULT_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")

# Cookie 文件路径
COOKIE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cookies.txt")

# 支持的平台
PLATFORMS = {
    "douyin": {
        "name": "抖音",
        "domains": ["douyin.com", "v.douyin.com"],
        "collection_paths": ["/collection/", "/mix/", "/series/"],
        "video_path": "/video/",
    },
    "hongguo": {
        "name": "红果短剧",
        "domains": ["hgshort.com", "hongguo.com", "ixigua.com"],
        "collection_paths": ["/drama/", "/play/"],
        "video_path": "/video/",
    },
}


def get_config():
    """获取配置"""
    return {
        "output_dir": DEFAULT_OUTPUT_DIR,
        "cookie_file": COOKIE_FILE,
        "platforms": PLATFORMS,
    }
