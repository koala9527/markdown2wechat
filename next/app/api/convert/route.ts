import { NextRequest, NextResponse } from "next/server";
import MarkdownIt from "markdown-it";
// highlight.js 的正确导入方式
// highlight.js 11.x 可能使用 CommonJS 导出
// @ts-ignore
const hljs = require("highlight.js");
// 尝试获取实际的 highlight.js 对象
const hljsInstance = hljs.default || hljs;
import {
  getCustomCss,
  getDefaultThemeName,
  getThemeStyle,
} from "../../../lib/theme";
import { transformToMdniceFormat } from "../../../lib/mdnice-transform-v2";
import { applyInlineStyles } from "../../../lib/mdnice-inline-styles";

// 简单的 HTML 转义函数
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 创建 markdown-it 实例，配置语法高亮
const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  highlight: function (str: string, lang: string) {
    // 统一将所有代码块都当作 bash 处理（用户要求）
    // 这样可以避免某些语言格式导致的解析问题
    const normalizedLang = lang ? 'bash' : '';
    
    // 如果指定了语言，尝试进行语法高亮
    if (normalizedLang && hljsInstance) {
      try {
        // highlight.js 11.x 的 API
        // 尝试使用 highlight 方法
        let result: any = null;
        
        // 方法1: 直接调用 highlight (highlight.js 11.x)
        if (typeof hljsInstance.highlight === "function") {
          try {
            result = hljsInstance.highlight(str, { language: normalizedLang });
          } catch (e) {
            // 如果失败，尝试其他方法
          }
        }
        
        // 方法2: 如果方法1失败，尝试使用旧的 API
        if (!result && typeof hljsInstance.highlight === "function") {
          try {
            result = hljsInstance.highlight(normalizedLang, str);
          } catch (e) {
            // 继续尝试
          }
        }
        
        // 如果成功高亮，返回结果
        if (result && result.value) {
          // markdown-it 的 highlight 函数只需要返回 <code> 标签内的内容
          // markdown-it 会自动添加 <pre><code> 标签
          return result.value;
        }
      } catch (err) {
        // 如果高亮失败，返回默认的转义代码
      }
    }
    
    // 如果没有指定语言或不支持，返回默认的转义代码
    // markdown-it 会自动添加 <pre><code> 标签
    return escapeHtml(str);
  },
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const markdown: string = body.markdown ?? "";
    const theme: string | null = body.theme ?? null;

    const themeName = theme || getDefaultThemeName();
    if (!themeName) {
      return NextResponse.json(
        {
          success: false,
          error: "未找到任何主题，请先在 theme/ 目录中放置主题配置。",
        },
        { status: 400 }
      );
    }

    let htmlContent = md.render(markdown);
    
    // 重要：修复 markdown-it 可能解析错误的代码块
    // 如果 <pre> 标签包含了后续的 HTML 标签（如 <h3>、<ol>、<ul> 等），说明代码块没有正确闭合
    // 我们需要找到第一个 </code> 标签，只保留到那里的内容
    htmlContent = htmlContent.replace(/(<pre[^>]*>)([\s\S]*?)(<\/pre>)/gi, (match, preOpen, preContent, preClose) => {
      // 检查 <pre> 内容中是否包含不应该在代码块中的 HTML 标签
      if (preContent.match(/<(h[1-6]|ol|ul|table|blockquote|hr|p)[\s>]/i)) {
        // 找到第一个 </code> 标签的位置
        const codeEndIndex = preContent.indexOf('</code>');
        if (codeEndIndex > 0) {
          // 只保留到第一个 </code> 标签的内容
          const validContent = preContent.substring(0, codeEndIndex + 7); // 7 是 '</code>' 的长度
          return preOpen + validContent + preClose;
        }
      }
      return match;
    });

    // 转换为 mdnice 格式
    htmlContent = transformToMdniceFormat(`<div id="nice">${htmlContent}</div>`);

    // 获取主题样式
    const themeStyle = getThemeStyle(themeName);
    const customCss = getCustomCss(themeName);
    
    // 将 CSS 样式内联到元素上
    const combinedCss = `${themeStyle}\n${customCss}`;
    htmlContent = applyInlineStyles(htmlContent, combinedCss);

    // 组合完整的HTML（不再需要 style 标签，样式已内联）
    const fullHtml = htmlContent;

    return NextResponse.json({
      success: true,
      html: fullHtml,
      style: themeStyle,
      customCss,
      theme: themeName,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: e?.message || String(e),
      },
      { status: 500 }
    );
  }
}


