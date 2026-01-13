import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

THEMES_URL = "https://api.mdnice.com/themes?pageSize=100&currentPage=1"
STYLES_URL = "https://api.mdnice.com/articles/styles"

# 项目根目录（spider 目录的上一级）
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# 加载项目根目录下的 .env
load_dotenv(PROJECT_ROOT / ".env")

# 主题保存目录（保存到 next/theme 目录）
THEME_DIR = PROJECT_ROOT / "next" / "theme"
THEME_DIR.mkdir(parents=True, exist_ok=True)

MDNICE_AUTH = os.environ.get("MDNICE_AUTH", "")      # 从 .env 读取 Authorization

HEADERS = {
    # 对齐浏览器请求头，尽量模拟正常访问
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "application/json;charset=UTF-8",
    "Origin": "https://editor.mdnice.com",
    "Referer": "https://editor.mdnice.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/143.0.0.0 Safari/537.36"
    ),
}
if MDNICE_AUTH:
    HEADERS["authorization"] = MDNICE_AUTH


def sanitize_filename(name: str) -> str:
    """将主题名称转换为安全的文件名"""
    invalid_chars = '\\/:*?\"<>|'
    for ch in invalid_chars:
        name = name.replace(ch, "_")
    name = name.strip()
    return name or "unnamed"


def fetch_theme_list() -> list[dict]:
    """从 mdnice 获取主题列表"""
    print("[INFO] 请求主题列表...", THEMES_URL)
    resp = requests.get(THEMES_URL, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise RuntimeError(f"获取主题列表失败: {data}")

    theme_list = data.get("data", {}).get("themeList", [])
    print(f"[INFO] 共获取到 {len(theme_list)} 个主题")
    return theme_list


def fetch_theme_style(out_id: str, theme_id: int) -> dict | None:
    """根据 outId 和 themeId 请求主题样式配置"""
    payload = {"outId": out_id, "themeId": theme_id}
    print(f"[INFO] 获取主题样式 outId={out_id}, themeId={theme_id}")
    # 使用 json=payload，让 requests 自动设置请求体
    resp = requests.put(STYLES_URL, headers=HEADERS, json=payload, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        # 某些主题可能返回「文章不存在」等错误，这里仅打印警告并跳过
        code = data.get("code")
        msg = data.get("message")
        print(f"[WARN] 获取主题样式失败(code={code}, message={msg})，跳过该主题。")
        return None
    return data


def save_theme_json(theme_name: str, content: dict) -> Path:
    """将主题样式 JSON 保存到 theme 目录，以主题名称命名"""
    safe_name = sanitize_filename(theme_name)
    target_path = THEME_DIR / f"{safe_name}.json"
    with target_path.open("w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=2)
    print(f"[INFO] 已保存主题 '{theme_name}' -> {target_path}")
    return target_path


def main() -> None:
    if not MDNICE_AUTH:
        print("[WARN] 未设置 MDNICE_AUTH 环境变量，将无法通过 Authorization 访问接口。")
        print("      请在项目根目录创建 .env，内容类似：")
        print("      MDNICE_AUTH=Bearer xxx.yyy.zzz")

    theme_list = fetch_theme_list()

    for idx, theme in enumerate(theme_list, start=1):
        theme_id = theme.get("themeId")
        name = theme.get("name") or f"theme_{theme_id}"
        out_id = theme.get("writingOutId") or theme.get("outId")

        if not out_id or theme_id is None:
            print(f"[WARN] 跳过无效主题: {theme}")
            continue

        print(f"\n[INFO] ({idx}/{len(theme_list)}) 处理主题: {name} (id={theme_id})")

        try:
            style_data = fetch_theme_style(out_id, theme_id)
            if not style_data:
                # 已在 fetch_theme_style 打印具体原因，这里直接跳过
                continue
            save_theme_json(name, style_data)
            # 稍微休眠一下，避免请求过快
            time.sleep(0.2)
        except Exception as e:
            print(f"[ERROR] 主题 '{name}' 获取失败: {e}")
            continue

    print("\n[INFO] 所有主题处理完成。JSON 文件已保存在: ", THEME_DIR)


if __name__ == "__main__":
    main()

