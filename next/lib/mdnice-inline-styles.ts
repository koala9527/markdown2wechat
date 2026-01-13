import * as cheerio from "cheerio";

/**
 * 将 CSS 样式内联到 HTML 元素上
 * 解析 CSS 规则并应用到对应的元素
 */
export function applyInlineStyles(htmlContent: string, cssContent: string): string {
  const $ = cheerio.load(htmlContent);

  // 解析 CSS 规则
  const rules = parseCSS(cssContent);

  // 应用样式规则
  rules.forEach((rule) => {
    try {
      const $elements = $(rule.selector);
      $elements.each((_, element) => {
        const $el = $(element);
        const existingStyle = $el.attr("style") || "";
        const newStyle = rule.declarations
          .map((decl) => `${decl.property}: ${decl.value}`)
          .join("; ");

        // 合并样式
        if (existingStyle) {
          $el.attr("style", `${existingStyle}; ${newStyle}`);
        } else {
          $el.attr("style", newStyle);
        }
      });
    } catch (e) {
      // 忽略无法解析的选择器
      console.warn(`无法应用样式规则: ${rule.selector}`, e);
    }
  });

  // 后处理：特殊处理某些元素
  postProcessStyles($);

  // 提取内容
  let result = $.html();
  if (result.includes("<html>")) {
    const bodyMatch = result.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      result = bodyMatch[1];
    }
  }

  return result;
}

/**
 * 解析 CSS 内容为规则数组
 */
function parseCSS(css: string): CSSRule[] {
  const rules: CSSRule[] = [];
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(css)) !== null) {
    const selector = match[1].trim();
    const declarationsStr = match[2].trim();
    const declarations: CSSDeclaration[] = [];

    // 解析声明
    declarationsStr.split(";").forEach((decl) => {
      const colonIndex = decl.indexOf(":");
      if (colonIndex > 0) {
        const property = decl.substring(0, colonIndex).trim();
        const value = decl.substring(colonIndex + 1).trim();
        if (property && value) {
          declarations.push({ property, value });
        }
      }
    });

    if (declarations.length > 0) {
      rules.push({ selector, declarations });
    }
  }

  return rules;
}

/**
 * 后处理样式
 */
function postProcessStyles($: cheerio.CheerioAPI): void {
  // 移除代码块装饰器 span 的 line-height
  $("pre.custom > span").first().each((_, element) => {
    const $span = $(element);
    let style = $span.attr("style") || "";
    style = style.replace(/line-height:\s*[^;]+;?/gi, "");
    $span.attr("style", style);
  });

  // 确保代码块有正确的默认样式（尽量还原 mdnice 官方效果）
  $("code.hljs").each((_, element) => {
    const $code = $(element);
    let style = $code.attr("style") || "";

    // 如果没有背景色，设置暗色背景
    if (!/background\s*:/.test(style)) {
      style = `background: #282c34; ${style}`;
    }

    // 如果没有文字颜色，设置默认文字颜色
    if (!/color\s*:/.test(style)) {
      style = `color: #abb2bf; ${style}`;
    }

    // 统一 padding（如果不存在 padding，则设置 16px）
    if (!/padding\s*:/.test(style)) {
      style = `padding: 16px; ${style}`;
    }

    // 确保有 padding-top（防止被覆盖掉）
    if (!/padding-top\s*:/.test(style)) {
      style = `padding-top: 15px; ${style}`;
    }

    // 圆角
    if (!/border-radius\s*:/.test(style)) {
      style = `border-radius: 5px; ${style}`;
    }

    // 横向滚动
    if (!/overflow-x\s*:/.test(style)) {
      style = `overflow-x: auto; ${style}`;
    }

    // 字体与字号（符合 mdnice 的代码风格）
    if (!/font-family\s*:/.test(style)) {
      style = `font-family: Consolas, Monaco, Menlo, monospace; ${style}`;
    }
    if (!/font-size\s*:/.test(style)) {
      style = `font-size: 12px; ${style}`;
    }

    $code.attr("style", style.trim());
  });
}

interface CSSRule {
  selector: string;
  declarations: CSSDeclaration[];
}

interface CSSDeclaration {
  property: string;
  value: string;
}

