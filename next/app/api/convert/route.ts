import { NextRequest, NextResponse } from "next/server";
import MarkdownIt from "markdown-it";
import {
  getCustomCss,
  getDefaultThemeName,
  getThemeStyle,
} from "../../../lib/theme";

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

    const htmlContent = md.render(markdown);

    const themeStyle = getThemeStyle(themeName);
    const customCss = getCustomCss(themeName);

    const fullHtml = `<div id="nice">
${htmlContent}
</div>
<style>
${themeStyle}
${customCss}
</style>`;

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


