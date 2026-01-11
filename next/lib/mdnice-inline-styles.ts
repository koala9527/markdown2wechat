/**
 * 将 CSS 样式内联到 HTML 元素上
 * 使用 cheerio 进行 DOM 解析，与 Python 版本保持一致
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

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
  
  // 移除 @media 等规则（暂时跳过）
  cssText = cssText.replace(/@[^{]+\{[^}]*\{[^}]*\}[^}]*\}/g, '');
  
  // 匹配 CSS 规则：选择器 { 样式 }
  // 使用更精确的匹配，处理嵌套大括号
  let i = 0;
  while (i < cssText.length) {
    // 找到选择器开始（跳过空白）
    if (/\s/.test(cssText[i])) {
      i++;
      continue;
    }
    
    // 找到第一个 {
    const braceStart = cssText.indexOf('{', i);
    if (braceStart === -1) {
      break;
    }
    
    const selector = cssText.substring(i, braceStart).trim();
    
    // 找到匹配的 }
    let braceCount = 1;
    let braceEnd = braceStart + 1;
    while (braceEnd < cssText.length && braceCount > 0) {
      if (cssText[braceEnd] === '{') {
        braceCount++;
      } else if (cssText[braceEnd] === '}') {
        braceCount--;
      }
      braceEnd++;
    }
    
    if (braceCount === 0) {
      const styles = cssText.substring(braceStart + 1, braceEnd - 1).trim();
      
      // 处理逗号分隔的多个选择器
      const selectors = selector.split(',').map(s => s.trim());
      for (const sel of selectors) {
        if (sel && styles) {
          // 清理选择器
          const cleaned = sel.replace(/\s+/g, ' ');
          rules.push({ selector: cleaned, styles });
        }
      }
    }
    
    i = braceEnd;
  }
  
  return rules;
}

/**
 * 检查 CSS 选择器是否匹配元素
 */
function selectorMatchesElement(selector: string, element: Element, $: cheerio.CheerioAPI): boolean {
  if (!selector || !element || !element.tagName) {
    return false;
  }
  
  const tagName = element.tagName.toLowerCase();
  
  // 移除伪类和伪元素
  let cleanSelector = selector.replace(/:[a-z-]+(\([^)]*\))?/g, '');
  cleanSelector = cleanSelector.replace(/::[a-z-]+/g, '');
  
  // 处理后代选择器和子选择器（简化：只检查最后一个部分）
  if (/\s|>/.test(cleanSelector)) {
    const parts = cleanSelector.split(/[\s>]+/);
    cleanSelector = parts[parts.length - 1] || cleanSelector;
  }
  
  // 处理组合选择器（如 h1.content, #nice h1, .content 等）
  // 提取标签、class 和 id
  const tagMatch = cleanSelector.match(/^([a-z0-9]+)/);
  const expectedTagName = tagMatch ? tagMatch[1] : null;
  
  const classes = (cleanSelector.match(/\.([a-z0-9_-]+)/g) || []).map(c => c.substring(1));
  const ids = (cleanSelector.match(/#([a-z0-9_-]+)/g) || []).map(id => id.substring(1));
  
  // 检查标签
  if (expectedTagName && tagName !== expectedTagName) {
    return false;
  }
  
  // 检查 class
  if (classes.length > 0) {
    const $element = $(element);
    const elementClasses = $element.attr('class') || '';
    const classList = elementClasses.split(/\s+/).filter(c => c);
    for (const cls of classes) {
      if (!classList.includes(cls)) {
        return false;
      }
    }
  }
  
  // 检查 id
  if (ids.length > 0) {
    const $element = $(element);
    const elementId = $element.attr('id') || '';
    for (const id of ids) {
      if (elementId !== id) {
        return false;
      }
    }
  }
  
  // 如果没有指定标签、class 或 id，则匹配所有元素（不应该发生）
  if (!expectedTagName && classes.length === 0 && ids.length === 0) {
    return false;
  }
  
  return true;
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
  
  // 解析现有样式为对象
  const existingProps: Record<string, string> = {};
  existing.split(';').forEach(prop => {
    const trimmed = prop.trim();
    if (trimmed) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        if (key && value) {
          existingProps[key] = value;
        }
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
        if (key && value) {
          existingProps[key] = value; // 新样式覆盖旧样式
        }
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
  if (/\s|>/.test(selector)) {
    priority += 5;
  }
  return priority;
}

/**
 * 将 CSS 样式内联到 HTML 元素上
 */
export function applyInlineStyles(htmlContent: string, cssText: string): string {
  const $ = cheerio.load(htmlContent);
  
  // 解析 CSS 规则
  const cssRules = parseCssRules(cssText);
  
  // 按选择器优先级排序
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
  
  // 应用样式到元素
  for (const { selector, styles } of indexedRules) {
    // 清理选择器
    const cleanSelector = selector.trim();
    if (!cleanSelector) {
      continue;
    }
    
    // 跳过伪类和伪元素选择器（这些样式不应该应用到元素本身）
    if (cleanSelector.includes('::') || /:[a-z-]+(\([^)]*\))?/.test(cleanSelector)) {
      continue;
    }
    
    // 处理后代选择器和子选择器
    if (/\s|>/.test(cleanSelector)) {
      const parts = cleanSelector.split(/[\s>]+/);
      // 处理 #nice pre.custom 这种情况
      if (parts.length > 1) {
        // 检查第一部分是否是 #nice
        if (parts[0] === '#nice') {
          // 在 #nice 内部查找匹配的元素
          const niceSection = $('#nice');
          if (niceSection.length > 0) {
            const finalSelector = parts.slice(1).join(' ');
            // 在 niceSection 内部查找
            if (finalSelector.startsWith('.')) {
              const classVal = finalSelector.substring(1).split(':')[0];
              niceSection.find(`.${classVal}`).each((_, element) => {
                if ('tagName' in element && selectorMatchesElement(finalSelector, element as Element, $)) {
                  const existingStyle = $(element).attr('style') || '';
                  $(element).attr('style', mergeStyles(existingStyle, styles));
                }
              });
            } else if (finalSelector.startsWith('#')) {
              const idVal = finalSelector.substring(1).split('.')[0].split(':')[0];
              const element = niceSection.find(`#${idVal}`)[0];
              if (element && selectorMatchesElement(finalSelector, element, $)) {
                const existingStyle = $(element).attr('style') || '';
                $(element).attr('style', mergeStyles(existingStyle, styles));
              }
            } else {
              // 标签选择器或组合选择器（如 pre.custom, h1 .content）
              // 处理后代选择器（如 h1 .content）
              if (/\s/.test(finalSelector)) {
                // 这是后代选择器，需要在父元素内查找
                const parts2 = finalSelector.split(/\s+/);
                const parentTag = parts2[0];
                const childSelector = parts2.slice(1).join(' ');
                
                // 在 niceSection 内查找父元素
                niceSection.find(parentTag).each((_, parent) => {
                  // 在父元素内查找子元素
                  if (childSelector.startsWith('.')) {
                    const classVal = childSelector.substring(1).split(':')[0];
                    $(parent).find(`.${classVal}`).each((_, child) => {
                      if ('tagName' in child && selectorMatchesElement(childSelector, child as Element, $)) {
                        const existingStyle = $(child).attr('style') || '';
                        $(child).attr('style', mergeStyles(existingStyle, styles));
                      }
                    });
                  } else {
                    // 其他情况
                    $(parent).find('*').each((_, child) => {
                      if ('tagName' in child && selectorMatchesElement(childSelector, child as Element, $)) {
                        const existingStyle = $(child).attr('style') || '';
                        $(child).attr('style', mergeStyles(existingStyle, styles));
                      }
                    });
                  }
                });
              } else {
                // 单个选择器
                const tagMatch = finalSelector.match(/^([a-z0-9]+)/);
                const tagName = tagMatch ? tagMatch[1] : null;
                
                if (tagName) {
                  // 查找所有匹配的元素
                  niceSection.find(tagName).each((_, element) => {
                    if ('tagName' in element && selectorMatchesElement(finalSelector, element as Element, $)) {
                      const existingStyle = $(element).attr('style') || '';
                      $(element).attr('style', mergeStyles(existingStyle, styles));
                    }
                  });
                } else {
                  // 没有标签，可能是纯 class（如 .custom）
                  if (finalSelector.startsWith('.')) {
                    const classVal = finalSelector.substring(1).split(':')[0];
                    niceSection.find(`.${classVal}`).each((_, element) => {
                      if ('tagName' in element && selectorMatchesElement(finalSelector, element as Element, $)) {
                        const existingStyle = $(element).attr('style') || '';
                        $(element).attr('style', mergeStyles(existingStyle, styles));
                      }
                    });
                  }
                }
              }
            }
          }
          continue;
        }
      }
    }
    
    // 特殊处理 #nice 选择器（单独的选择器，不是后代选择器）
    if (cleanSelector === '#nice' && !/\s/.test(cleanSelector)) {
      const niceSection = $('#nice');
      if (niceSection.length > 0) {
        const existingStyle = niceSection.attr('style') || '';
        niceSection.attr('style', mergeStyles(existingStyle, styles));
      }
      continue;
    }
    
    // 查找所有可能匹配的元素
    const candidates: Element[] = [];
    
    if (cleanSelector.startsWith('#')) {
      // ID 选择器
      const idVal = cleanSelector.substring(1).split('.')[0].split(':')[0];
      const element = $(`#${idVal}`)[0];
      // 检查是否是 Element 类型
      if (element && 'tagName' in element && selectorMatchesElement(cleanSelector, element as Element, $)) {
        candidates.push(element as Element);
      }
    } else if (cleanSelector.startsWith('.')) {
      // Class 选择器
      const classVal = cleanSelector.substring(1).split(':')[0];
      $(`.${classVal}`).each((_, element) => {
        // 检查是否是 Element 类型
        if ('tagName' in element && selectorMatchesElement(cleanSelector, element as Element, $)) {
          candidates.push(element as Element);
        }
      });
    } else {
      // 标签选择器或组合选择器
      const tagMatch = cleanSelector.match(/^([a-z0-9]+)/);
      const tagName = tagMatch ? tagMatch[1] : null;
      
      if (tagName) {
        $(tagName).each((_, element) => {
          // 检查是否是 Element 类型
          if ('tagName' in element && selectorMatchesElement(cleanSelector, element as Element, $)) {
            candidates.push(element as Element);
          }
        });
      } else {
        // 没有标签，可能是纯 class 或 id（前面已处理）
        $('*').each((_, element) => {
          // 检查是否是 Element 类型
          if ('tagName' in element && selectorMatchesElement(cleanSelector, element as Element, $)) {
            candidates.push(element as Element);
          }
        });
      }
    }
    
    // 应用样式到匹配的元素
    for (const element of candidates) {
      // 确保元素在 #nice section 内
      const niceSection = $('#nice');
      if (niceSection.length > 0) {
        const $element = $(element);
        const isInNice = $element.closest('#nice').length > 0 || niceSection.find($element).length > 0;
        if (!isInNice) {
          continue;
        }
      }
      
      const existingStyle = $(element).attr('style') || '';
      $(element).attr('style', mergeStyles(existingStyle, styles));
    }
  }
  
  // 确保 span.prefix 和 span.suffix 只有 display: none
  $('span.prefix, span.suffix').attr('style', 'display: none;');
  
  // 获取结果
  let result = $.html();
  
  // 修复 cheerio 可能添加的额外标签
  if (result.includes('<html>')) {
    const bodyMatch = result.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      result = bodyMatch[1];
    }
  }
  
  // 替换所有 <br/> 为 <br>（与 target.html 保持一致）
  result = result.replace(/<br\/>/g, '<br>');
  
  // 修复最后的 </div> 为 </section>（如果存在）
  result = result.replace(/<\/div>\s*$/, '</section>');
  
  // 清理双分号
  result = result.replace(/;;+/g, ';');
  
  // 清理颜色格式：将 rgba(0, 150, 136, 1) 转换为 rgb(0, 150, 136)
  result = result.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*1\)/g, 'rgb($1, $2, $3)');
  
  // 清理多余的样式属性（如 content: unset）
  result = result.replace(/content:\s*unset;?\s*/gi, '');
  
  return result;
}
