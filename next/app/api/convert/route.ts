import { NextRequest, NextResponse } from "next/server";
import MarkdownIt from "markdown-it";
import {
  getCustomCss,
  getDefaultThemeName,
  getThemeStyle,
} from "../../../lib/theme";
import { transformToMdniceFormat } from "../../../lib/mdnice-transform";
import { applyInlineStyles } from "../../../lib/mdnice-inline-styles";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
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


