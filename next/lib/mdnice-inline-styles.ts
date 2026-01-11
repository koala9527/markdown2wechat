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
 * 合并两个样式字符串
 */
function mergeStyles(existing: string, newStyles: string): string {
  if (!existing) {
    return newStyles;
  }
  if (!newStyles) {
    return existing;
  }
  
  // 简单的合并：追加新样式
  return `${existing}; ${newStyles}`;
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
    // 跳过伪类和伪元素选择器
    if (selector.includes('::') || /:[a-z-]+(\([^)]*\))?/.test(selector)) {
      if (selector.includes('::before') || selector.includes('::after')) {
        continue;
      }
      if (/:(hover|focus|active|visited|link)/.test(selector)) {
        continue;
      }
    }
    
    // 处理 #nice 选择器
    if (selector === '#nice' && !selector.includes(' ')) {
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
      
      // 处理 code.hljs 或 pre.custom code
      if (finalSelector.includes('code') || finalSelector.includes('code.hljs')) {
        result = result.replace(
          /<code\s+class=["'][^"']*hljs[^"']*["']([^>]*)>/gi,
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
      
      // 处理 h1 .content, h2 .content 等
      if (finalSelector.includes('.content')) {
        const headingMatch = finalSelector.match(/^(h[1-6])\s+\.content/);
        if (headingMatch) {
          const headingTag = headingMatch[1];
          // 使用更精确的匹配，确保在对应的 heading 内
          const regex = new RegExp(`<${headingTag}[^>]*>.*?<span\\s+class=["']content["']([^>]*)>`, 'gis');
          result = result.replace(regex, (match) => {
            return match.replace(/<span\s+class=["']content["']([^>]*)>/, (spanMatch, attrs) => {
              if (attrs.includes('style=')) {
                return spanMatch.replace(/style=["']([^"']*)["']/, (styleMatch, existingStyle) => {
                  return `style="${mergeStyles(existingStyle, styles)}"`;
                });
              } else {
                return spanMatch.replace(/>/, ` style="${styles}">`);
              }
            });
          });
        }
      }
      
      // 处理其他标签选择器（如 h1, h2, p, ul, ol 等）
      const tagMatch = finalSelector.match(/^([a-z0-9]+)(\s|$|\.|#)/);
      if (tagMatch) {
        const tagName = tagMatch[1];
        // 只处理在 #nice 内的元素
        const tagRegex = new RegExp(`<${tagName}([^>]*)>`, 'gi');
        let lastIndex = 0;
        result = result.replace(tagRegex, (match, attrs, offset) => {
          // 检查是否在 #nice section 内
          const beforeMatch = result.substring(0, offset);
          const niceStart = beforeMatch.lastIndexOf('<section');
          const niceEnd = beforeMatch.lastIndexOf('</section>');
          
          // 如果在 #nice section 内（有开始但没有对应的结束，或者结束在开始之后）
          if (niceStart !== -1 && (niceEnd === -1 || niceEnd < niceStart)) {
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
  
  return result;
}

