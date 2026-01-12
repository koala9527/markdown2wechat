import { NextRequest, NextResponse } from "next/server";
import MarkdownIt from "markdown-it";
// @ts-ignore - highlight.js 可能没有完整的类型定义
import * as hljs from "highlight.js";
import {
  getCustomCss,
  getDefaultThemeName,
  getThemeStyle,
} from "../../../lib/theme";
import { transformToMdniceFormat } from "../../../lib/mdnice-transform";
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
    // 如果指定了语言且 highlight.js 支持该语言，则进行语法高亮
    if (lang && hljs.getLanguage(lang)) {
      try {
        // highlight.js 会返回高亮后的 HTML，包含 <span class="hljs-*"> 标签
        const highlighted = hljs.highlight(str, { language: lang }).value;
        // markdown-it 的 highlight 函数只需要返回 <code> 标签内的内容
        // markdown-it 会自动添加 <pre><code> 标签
        return highlighted;
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


