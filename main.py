from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import json
import markdown
from pathlib import Path
from pydantic import BaseModel
from typing import Dict, List
from mdnice_transform import transform_to_mdnice_format
from mdnice_inline_styles import apply_inline_styles

app = FastAPI(title="Markdown to WeChat Converter")

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

# 模板目录
templates = Jinja2Templates(directory="templates")

# 主题目录（由爬虫脚本 spider/spider.py 生成）
THEME_DIR = Path("theme")
THEME_DIR.mkdir(parents=True, exist_ok=True)

# 缓存：按主题名称缓存配置和样式
_theme_config_cache: Dict[str, dict] = {}
_theme_style_cache: Dict[str, str] = {}
_custom_css_cache: Dict[str, str] = {}


def list_theme_names() -> List[str]:
    """列出 theme 目录下所有主题名称（按文件名去掉后缀）"""
    if not THEME_DIR.exists():
        return []
    names = sorted(p.stem for p in THEME_DIR.glob("*.json"))
    return names


def get_default_theme_name() -> str | None:
    """获取默认主题名称：theme 目录中的第一个"""
    names = list_theme_names()
    return names[0] if names else None


def get_theme_path(theme_name: str) -> Path:
    return THEME_DIR / f"{theme_name}.json"


def load_theme_config(theme_name: str) -> dict:
    """根据主题名称加载主题配置（带缓存）"""
    if theme_name in _theme_config_cache:
        return _theme_config_cache[theme_name]

    path = get_theme_path(theme_name)
    if not path.exists():
        raise FileNotFoundError(f"主题配置文件不存在: {path}")

    with path.open("r", encoding="utf-8") as f:
        config = json.load(f)
    _theme_config_cache[theme_name] = config
    return config


def get_theme_style(theme_name: str) -> str:
    """获取指定主题的样式 CSS（带缓存）"""
    if theme_name in _theme_style_cache:
        return _theme_style_cache[theme_name]

    config = load_theme_config(theme_name)
    style = config.get("data", {}).get("style", "")
    # CSS 已经是压缩格式，直接返回即可
    _theme_style_cache[theme_name] = style
    return style


def get_custom_css(theme_name: str) -> str:
    """获取指定主题的自定义 CSS（带缓存）"""
    if theme_name in _custom_css_cache:
        return _custom_css_cache[theme_name]

    config = load_theme_config(theme_name)
    style_model_list = config.get("data", {}).get("styleModelList", [])

    custom_css = ""
    for model in style_model_list:
        if model.get("id") == "customStyle":
            styles = model.get("styles", [])
            for style_item in styles:
                if style_item.get("id") == "customCss":
                    custom_css = style_item.get("value", "") or ""
                    break
    _custom_css_cache[theme_name] = custom_css
    return custom_css


class MarkdownRequest(BaseModel):
    markdown: str
    theme: str | None = None  # 主题名称，可选


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """首页"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/convert")
async def convert_markdown(request: MarkdownRequest):
    """转换Markdown为公众号格式HTML"""
    try:
        # 确定主题名称
        theme_name = request.theme or get_default_theme_name()
        if not theme_name:
            raise RuntimeError("未找到任何主题，请先运行 spider/spider.py 下载主题。")

        # 配置Markdown扩展
        md = markdown.Markdown(
            extensions=[
                "extra",  # 包含表格、代码块等
                "codehilite",  # 代码高亮
                "tables",  # 表格支持
                "toc",  # 目录
                "fenced_code",  # 围栏代码块
                "nl2br",  # 换行转<br>
            ],
            extension_configs={
                "codehilite": {
                    "css_class": "highlight",
                    "use_pygments": False,  # 不使用pygments，使用简单样式
                }
            },
        )

        html_content = md.convert(request.markdown)

        # 转换为 mdnice 格式
        html_content = transform_to_mdnice_format(f'<div id="nice">{html_content}</div>')

        # 获取主题样式
        theme_style = get_theme_style(theme_name)
        custom_css = get_custom_css(theme_name)
        
        # 将 CSS 样式内联到元素上
        combined_css = f"{theme_style}\n{custom_css}"
        html_content = apply_inline_styles(html_content, combined_css)

        # 组合完整的HTML（不再需要 style 标签，样式已内联）
        full_html = html_content

        return JSONResponse(
            {
                "success": True,
                "html": full_html,
                "style": theme_style,
                "customCss": custom_css,
                "theme": theme_name,
            }
        )
    except Exception as e:
        import traceback

        return JSONResponse(
            {
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc(),
            },
            status_code=500,
        )


@app.get("/api/theme")
async def get_theme(theme: str | None = None):
    """获取某个主题的完整配置，不传则返回默认主题"""
    try:
        theme_name = theme or get_default_theme_name()
        if not theme_name:
            raise RuntimeError("未找到任何主题，请先运行 spider/spider.py 下载主题。")

        config = load_theme_config(theme_name)
        return JSONResponse(
            {
                "success": True,
                "theme": theme_name,
                "data": config,
            }
        )
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


@app.get("/api/themes")
async def list_themes_api():
    """列出所有可用主题名称以及默认主题"""
    try:
        names = list_theme_names()
        default_theme = get_default_theme_name()
        return JSONResponse(
            {
                "success": True,
                "themes": names,
                "defaultTheme": default_theme,
            }
        )
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

