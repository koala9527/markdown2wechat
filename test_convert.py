"""
测试脚本：将 markdown 转换为 HTML，验证效果是否与 target.html 一致
"""
import json
from pathlib import Path
import markdown
from mdnice_transform import transform_to_mdnice_format
from mdnice_inline_styles import apply_inline_styles


def load_theme_config(theme_name: str) -> dict:
    """加载主题配置"""
    theme_path = Path("theme") / f"{theme_name}.json"
    if not theme_path.exists():
        raise FileNotFoundError(f"主题文件不存在: {theme_path}")
    
    with theme_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_theme_style(theme_name: str) -> str:
    """获取主题样式"""
    config = load_theme_config(theme_name)
    return config.get("data", {}).get("style", "")


def get_custom_css(theme_name: str) -> str:
    """获取自定义 CSS"""
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
    return custom_css


def convert_markdown_to_html(markdown_text: str, theme_name: str = "兰青") -> str:
    """将 Markdown 转换为 HTML"""
    # 配置 Markdown 扩展
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
    
    html_content = md.convert(markdown_text)
    
    # 转换为 mdnice 格式
    html_content = transform_to_mdnice_format(f'<div id="nice">{html_content}</div>')
    
    # 获取主题样式
    theme_style = get_theme_style(theme_name)
    custom_css = get_custom_css(theme_name)
    
    # 将 CSS 样式内联到元素上
    combined_css = f"{theme_style}\n{custom_css}"
    html_content = apply_inline_styles(html_content, combined_css)
    
    return html_content


def main():
    """主函数"""
    # 读取原始 markdown
    markdown_path = Path("example/resource.md")
    if not markdown_path.exists():
        print(f"错误：找不到文件 {markdown_path}")
        return
    
    with markdown_path.open("r", encoding="utf-8") as f:
        markdown_text = f.read()
    
    # 转换为 HTML
    print("正在转换 Markdown 到 HTML...")
    html_content = convert_markdown_to_html(markdown_text, theme_name="兰青")
    
    # 保存结果
    output_path = Path("example/self.html")
    with output_path.open("w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"转换完成！结果已保存到 {output_path}")
    print(f"HTML 长度: {len(html_content)} 字符")
    
    # 对比 target.html
    target_path = Path("example/target.html")
    if target_path.exists():
        with target_path.open("r", encoding="utf-8") as f:
            target_html = f.read()
        
        print(f"\n对比结果:")
        print(f"  target.html 长度: {len(target_html)} 字符")
        print(f"  self.html 长度: {len(html_content)} 字符")
        
        # 检查关键元素
        if 'pre class="custom"' in html_content:
            print("  [OK] 代码块已转换")
        else:
            print("  [FAIL] 代码块未正确转换")
        
        if 'display: flex' in html_content or 'display: block' in html_content:
            print("  [OK] display 样式已应用")
        else:
            print("  [FAIL] display 样式可能有问题")
        
        # 检查代码块样式
        if 'border-radius: 5px' in html_content and 'box-shadow' in html_content:
            print("  [OK] 代码块样式已应用")
        else:
            print("  [FAIL] 代码块样式可能不完整")


if __name__ == "__main__":
    main()

