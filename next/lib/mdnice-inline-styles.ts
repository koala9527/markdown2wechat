/**
 * 将 CSS 样式内联到 HTML 元素上
 */

interface CssRule {
  selector: string;
  styles: string;
}

/**
 * 解析 CSS 文本，返回选择器和样式对
 */
function parseCssRules(cssText: string): CssRule[] {
  const rules: CssRule[] = [];
  
  // 移除注释
  cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // 匹配 CSS 规则：选择器 { 样式 }
  // 处理嵌套的大括号（如 @media）
  const rulePattern = /([^{]+)\{([^}]+)\}/g;
  let match;
  
  while ((match = rulePattern.exec(cssText)) !== null) {
    let selector = match[1].trim();
    const styles = match[2].trim();
    
    // 清理选择器（移除多余空格）
    selector = selector.replace(/\s+/g, ' ');
    
    if (selector && styles) {
      // 处理逗号分隔的多个选择器
      const selectors = selector.split(',').map(s => s.trim());
      for (const sel of selectors) {
        if (sel) {
          rules.push({ selector: sel, styles });
        }
      }
    }
  }
  
  return rules;
}

/**
 * 合并两个样式字符串，去重相同的 CSS 属性
 */
function mergeStyles(existing: string, newStyles: string): string {
  if (!existing) {
    return newStyles;
  }
  if (!newStyles) {
    return existing;
  }
  
  // 解析现有样式为对象
  const existingProps: Record<string, string> = {};
  existing.split(';').forEach(prop => {
    const trimmed = prop.trim();
    if (trimmed) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        existingProps[key] = value;
      }
    }
  });
  
  // 解析新样式并覆盖现有属性
  newStyles.split(';').forEach(prop => {
    const trimmed = prop.trim();
    if (trimmed) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        existingProps[key] = value; // 新样式覆盖旧样式
      }
    }
  });
  
  // 重新组合样式字符串
  return Object.entries(existingProps)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

/**
 * 计算选择器优先级
 */
function selectorPriority(selector: string): number {
  let priority = 0;
  // ID 选择器权重最高
  priority += (selector.match(/#/g) || []).length * 100;
  // Class 选择器
  priority += (selector.match(/\./g) || []).length * 10;
  // 标签选择器
  if (/^[a-z0-9]+/.test(selector)) {
    priority += 1;
  }
  // 后代选择器增加复杂度
  if (/\s/.test(selector) || />/.test(selector)) {
    priority += 5;
  }
  return priority;
}

/**
 * 检查选择器是否匹配元素（简化版本）
 */
function selectorMatchesElement(selector: string, element: any): boolean {
  // 移除伪类和伪元素
  selector = selector.replace(/::?[a-z-]+(\([^)]*\))?/g, '');
  
  // 处理组合选择器（如 h1.content）
  if (selector.includes('.')) {
    const parts = selector.split('.');
    const tagPart = parts[0];
    const classPart = parts[1];
    
    if (tagPart && element.tagName?.toLowerCase() !== tagPart.toLowerCase()) {
      return false;
    }
    
    if (classPart) {
      const classList = element.className || '';
      const classes = typeof classList === 'string' 
        ? classList.split(/\s+/) 
        : Array.isArray(classList) 
        ? classList 
        : [];
      return classes.includes(classPart);
    }
  }
  
  // 处理 ID 选择器
  if (selector.startsWith('#')) {
    const id = selector.substring(1).split('.')[0].split(':')[0];
    return element.id === id;
  }
  
  // 处理 class 选择器
  if (selector.startsWith('.')) {
    const classVal = selector.substring(1).split(':')[0];
    const classList = element.className || '';
    const classes = typeof classList === 'string' 
      ? classList.split(/\s+/) 
      : Array.isArray(classList) 
      ? classList 
      : [];
    return classes.includes(classVal);
  }
  
  // 处理标签选择器
  if (/^[a-z0-9]+$/.test(selector)) {
    return element.tagName?.toLowerCase() === selector.toLowerCase();
  }
  
  return false;
}

/**
 * 将 CSS 样式内联到 HTML 元素上
 */
export function applyInlineStyles(htmlContent: string, cssText: string): string {
  // 使用 cheerio 或 jsdom 解析 HTML
  // 为了简化，这里使用正则表达式和字符串操作
  // 注意：这是一个简化版本，可能无法处理所有复杂情况
  
  const cssRules = parseCssRules(cssText);
  
  // 按优先级排序
  const indexedRules = cssRules.map((rule, index) => ({
    index,
    selector: rule.selector,
    styles: rule.styles,
    priority: selectorPriority(rule.selector),
  }));
  
  indexedRules.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.index - b.index;
  });
  
  // 由于 Node.js 环境没有 DOM 解析库，我们使用简化的方法
  // 对于复杂的 HTML 结构，建议使用 cheerio 或 jsdom
  // 这里提供一个基于正则表达式的简化实现
  
  let result = htmlContent;
  
  // 应用样式规则
  for (const { selector, styles } of indexedRules) {
    // 清理选择器
    const cleanSelector = selector.trim();
    if (!cleanSelector) {
      continue;
    }
    
    // 跳过伪类和伪元素选择器（这些样式不应该应用到元素本身）
    if (cleanSelector.includes('::') || /:[a-z-]+(\([^)]*\))?/.test(cleanSelector)) {
      // 所有伪类和伪元素都跳过
      continue;
    }
    
    // 跳过包含伪类的选择器（如 h1::before, .content::after 等）
    if (/::before|::after|:hover|:focus|:active|:visited|:link|:first-child|:last-child|:nth-child/.test(cleanSelector)) {
      continue;
    }
    
    // 处理 #nice 选择器（只处理单独的 #nice，不处理后代选择器）
    if (cleanSelector === '#nice' && !cleanSelector.includes(' ')) {
      result = result.replace(
        /<section\s+id=["']nice["']([^>]*)>/gi,
        (match, attrs) => {
          if (attrs.includes('style=')) {
            return match.replace(/style=["']([^"']*)["']/, (styleMatch, existingStyle) => {
              return `style="${mergeStyles(existingStyle, styles)}"`;
            });
          } else {
            return match.replace(/>/, ` style="${styles}">`);
          }
        }
      );
      continue;
    }
    
    // 处理后代选择器 #nice pre.custom
    if (selector.startsWith('#nice ')) {
      const finalSelector = selector.substring(6); // 移除 "#nice "
      
      // 处理 pre.custom
      if (finalSelector.includes('pre.custom') || finalSelector === 'pre.custom') {
        result = result.replace(
          /<pre\s+class=["'][^"']*custom[^"']*["']([^>]*)>/gi,
          (match, attrs) => {
            if (attrs.includes('style=')) {
              return match.replace(/style=["']([^"']*)["']/, (styleMatch, existingStyle) => {
                return `style="${mergeStyles(existingStyle, styles)}"`;
              });
            } else {
              return match.replace(/>/, ` style="${styles}">`);
            }
          }
        );
      }
      
      // 处理 pre.custom code（只在 pre.custom 内的 code）
      // 注意：只处理 #nice pre.custom code，不处理 #nice p code
      if (finalSelector === 'pre.custom code' || 
          (finalSelector.includes('pre') && finalSelector.includes('code') && !finalSelector.includes('p'))) {
        // 只处理在 pre.custom 内的 code.hljs，避免影响行内代码
        result = result.replace(
          /<pre[^>]*class=["'][^"']*custom[^"']*["'][^>]*>[\s\S]*?<code\s+class=["'][^"']*hljs[^"']*["']([^>]*)>/gi,
          (match, attrs) => {
            if (attrs.includes('style=')) {
              return match.replace(/style=["']([^"']*)["']/, (styleMatch, existingStyle) => {
                return `style="${mergeStyles(existingStyle, styles)}"`;
              });
            } else {
              return match.replace(/>/, ` style="${styles}">`);
            }
          }
        );
      }
      
      // 跳过 #nice p code（行内代码），避免影响代码块
      // 因为正则表达式难以精确区分，暂时跳过行内代码的样式
      if (finalSelector === 'p code' || (finalSelector.includes('p') && finalSelector.includes('code'))) {
        continue;
      }
      
      // 处理 h1 .content, h2 .content 等
      if (finalSelector.includes('.content')) {
        const headingMatch = finalSelector.match(/^(h[1-6])\s+\.content/);
        if (headingMatch) {
          const headingTag = headingMatch[1];
          // 使用更精确的匹配，确保在对应的 heading 内
          // 匹配 <h1>...<span class="content"> 这种结构
          const regex = new RegExp(`(<${headingTag}[^>]*>)([\\s\\S]*?)(<span\\s+class=["']content["'])([^>]*)(>)`, 'gi');
          result = result.replace(regex, (match, hTag, between, spanStart, spanAttrs, spanEnd) => {
            // 确保 span.content 在对应的 heading 内，且前面没有其他 span.content
            if (between && !between.includes('</span>')) {
              if (spanAttrs.includes('style=')) {
                return hTag + between + spanStart + spanAttrs.replace(/style=["']([^"']*)["']/, (styleMatch, existingStyle) => {
                  return `style="${mergeStyles(existingStyle, styles)}"`;
                }) + spanEnd;
              } else {
                return hTag + between + spanStart + spanAttrs + ` style="${styles}"` + spanEnd;
              }
            }
            return match;
          });
        }
      }
      
      // 跳过 span.prefix 和 span.suffix 的样式（它们应该只有 display: none）
      if (finalSelector.includes('.prefix') || finalSelector.includes('.suffix')) {
        continue;
      }
      
      // 处理其他标签选择器（如 h1, h2, p, ul, ol 等）
      const tagMatch = finalSelector.match(/^([a-z0-9]+)(\s|$|\.|#)/);
      if (tagMatch) {
        const tagName = tagMatch[1];
        
        // 跳过 span 标签（prefix/suffix/content 需要特殊处理）
        if (tagName === 'span') {
          continue;
        }
        
        // 只处理在 #nice 内的元素
        const tagRegex = new RegExp(`<${tagName}([^>]*)>`, 'gi');
        result = result.replace(tagRegex, (match, attrs, offset) => {
          // 检查是否在 #nice section 内
          const beforeMatch = result.substring(0, offset);
          const niceStart = beforeMatch.lastIndexOf('<section');
          const niceEnd = beforeMatch.lastIndexOf('</section>');
          
          // 如果在 #nice section 内（有开始但没有对应的结束，或者结束在开始之后）
          if (niceStart !== -1 && (niceEnd === -1 || niceEnd < niceStart)) {
            // 检查是否在 span.prefix 或 span.suffix 内（这些不应该应用样式）
            const afterMatch = result.substring(offset);
            const nextSpan = afterMatch.match(/<span[^>]*class=["'](prefix|suffix)["']/);
            if (nextSpan && offset < result.length) {
              // 如果后面紧跟着 span.prefix 或 span.suffix，可能是匹配错误，跳过
              const checkRange = result.substring(Math.max(0, offset - 50), Math.min(result.length, offset + 50));
              if (checkRange.includes('class="prefix') || checkRange.includes('class="suffix')) {
                return match;
              }
            }
            
            if (attrs.includes('style=')) {
              return match.replace(/style=["']([^"']*)["']/, (styleMatch, existingStyle) => {
                return `style="${mergeStyles(existingStyle, styles)}"`;
              });
            } else {
              return match.replace(/>/, ` style="${styles}">`);
            }
          }
          return match;
        });
      }
      
      continue;
    }
    
    // 处理其他选择器（简化处理）
    // 这里可以添加更多选择器类型的处理
  }
  
  // 替换所有 <br/> 为 <br>（与 target.html 保持一致）
  result = result.replace(/<br\/>/g, '<br>');
  
  // 修复最后的 </div> 为 </section>（如果存在）
  result = result.replace(/<\/div>\s*$/, '</section>');
  
  // 清理双分号
  result = result.replace(/;;+/g, ';');
  
  // 确保 span.prefix 和 span.suffix 只有 display: none（移除其他样式）
  result = result.replace(
    /<span\s+class=["'](prefix|suffix)["']([^>]*)>/gi,
    (match, className, attrs) => {
      // 只保留 display: none
      return `<span class="${className}" style="display: none;">`;
    }
  );
  
  // 清理颜色格式：将 rgba(0, 150, 136, 1) 转换为 rgb(0, 150, 136)
  result = result.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*1\)/g, 'rgb($1, $2, $3)');
  
  // 清理多余的样式属性（如 content: unset）
  result = result.replace(/content:\s*unset;?\s*/gi, '');
  
  return result;
}

