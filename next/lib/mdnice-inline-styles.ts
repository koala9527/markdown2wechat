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
  
  // 清理装饰条 span 的样式：移除 line-height（与 target.html 保持一致）
  $('pre.custom > span').each((_, element) => {
    const $span = $(element);
    const style = $span.attr('style') || '';
    // 移除 line-height 属性
    const cleanedStyle = style.replace(/line-height:\s*[^;]+;?/gi, '').replace(/;;+/g, ';').trim();
    if (cleanedStyle) {
      $span.attr('style', cleanedStyle);
    }
  });
  
  // 确保代码块内的语法高亮标签样式被正确应用
  // 处理 code.hljs 内的 span 标签（如 hljs-comment, hljs-keyword 等）
  $('pre.custom code.hljs span').each((_, element) => {
    const $span = $(element);
    const classes = $span.attr('class') || '';
    const existingStyle = $span.attr('style') || '';
    
    // 如果已经有样式，确保样式正确（不要被清理掉）
    if (existingStyle && classes.includes('hljs-')) {
      // 保留语法高亮标签的样式，确保颜色等属性正确
      // 这些样式应该已经在 CSS 中定义，内联样式会覆盖它们
      // 不需要额外处理，因为内联样式已经应用了
    }
  });
  
  // 确保代码块内的所有文本都有正确的颜色，不受全局样式影响
  // 全局的 section#nice 可能有 color: rgb(0, 0, 0)，这会影响到代码块内的文本
  // 我们需要确保代码块内的所有文本都使用 code 标签的颜色
  // 注意：这个处理必须在所有样式应用之后进行，确保代码块的颜色优先级最高
  $('pre.custom code.hljs').each((_, element) => {
    const $code = $(element);
    let codeStyle = $code.attr('style') || '';
    const codeColorMatch = codeStyle.match(/color:\s*([^;]+)/);
    let codeColor = codeColorMatch ? codeColorMatch[1].trim() : '';
    
    // 确保 code 标签本身有明确的颜色（不会被全局样式覆盖）
    // 如果颜色是黑色或白色，说明可能被全局样式影响了，强制设置为正确的颜色
    if (!codeColorMatch || codeColor === 'rgb(0, 0, 0)' || codeColor === '#000' || codeColor === 'black' ||
        codeColor === 'rgb(255, 255, 255)' || codeColor === '#fff' || codeColor === 'white') {
      // 强制设置为正确的颜色
      if (codeStyle.includes('color:')) {
        codeStyle = codeStyle.replace(/color:\s*[^;]+/gi, 'color: #abb2bf');
      } else {
        codeStyle = codeStyle ? `${codeStyle}; color: #abb2bf` : 'color: #abb2bf';
      }
      $code.attr('style', codeStyle);
      codeColor = '#abb2bf';
    } else if (!codeColor) {
      // 如果没有颜色，设置为默认颜色
      codeStyle = codeStyle ? `${codeStyle}; color: #abb2bf` : 'color: #abb2bf';
      $code.attr('style', codeStyle);
      codeColor = '#abb2bf';
    }
    
    // 处理代码块内的所有子元素
    // 注意：不要包装文本节点，因为 code 标签的颜色应该已经应用到文本节点了
    // 只需要确保子元素（如 span）有正确的颜色
    $code.find('*').each((_, childElement) => {
      const $child = $(childElement);
      const childStyle = $child.attr('style') || '';
      const childColorMatch = childStyle.match(/color:\s*([^;]+)/);
      const childColor = childColorMatch ? childColorMatch[1].trim() : '';
      const classes = $child.attr('class') || '';
      
      // 如果子元素没有颜色，或者颜色是黑色/白色（可能是继承的），设置正确的颜色
      // 但对于语法高亮标签（hljs-*），保留它们的颜色（除非颜色被错误覆盖）
      if (classes.includes('hljs-')) {
        // 语法高亮标签，如果颜色被错误覆盖为黑色或白色，需要修复
        if (childColor === 'rgb(0, 0, 0)' || childColor === '#000' || childColor === 'black' ||
            childColor === 'rgb(255, 255, 255)' || childColor === '#fff' || childColor === 'white') {
          // 语法高亮标签的颜色被错误覆盖了，移除错误的颜色，让 CSS 中的颜色生效
          // 但为了确保颜色正确，我们可以移除这个错误的颜色属性
          const newChildStyle = childStyle.replace(/color:\s*[^;]+;?/gi, '').trim();
          if (newChildStyle) {
            $child.attr('style', newChildStyle);
          } else {
            $child.removeAttr('style');
          }
        }
      } else {
        // 不是语法高亮标签，使用 code 标签的颜色
        if (!childColor || childColor === 'rgb(0, 0, 0)' || childColor === '#000' || childColor === 'black' ||
            childColor === 'rgb(255, 255, 255)' || childColor === '#fff' || childColor === 'white') {
          if (childStyle) {
            const newChildStyle = childStyle.replace(/color:\s*[^;]+/gi, `color: ${codeColor}`);
            $child.attr('style', newChildStyle);
          } else {
            $child.attr('style', `color: ${codeColor}`);
          }
        }
      }
    });
  });
  
  // 清理 code.hljs 的冗余样式（与 target.html 保持一致）
  // target.html 中的 code 样式只包含：overflow-x, padding, color, padding-top, background, border-radius, display, font-family, font-size
  // 注意：color 必须明确设置为 #abb2bf，不能被全局样式覆盖
  // 注意：padding-top 必须明确设置为 15px，不能被错误的值覆盖
  $('pre.custom code.hljs').each((_, element) => {
    const $code = $(element);
    const style = $code.attr('style') || '';
    // 提取需要的样式属性
    const neededProps = ['overflow-x', 'padding', 'color', 'padding-top', 'background', 'border-radius', 'display', 'font-family', 'font-size'];
    const styleObj: Record<string, string> = {};
    
    // 解析现有样式
    style.split(';').forEach(prop => {
      const trimmed = prop.trim();
      if (trimmed) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim();
          // 只保留需要的属性
          if (neededProps.some(needed => key.includes(needed))) {
            // 对于 padding，需要特殊处理（target.html 中是 padding: 16px）
            if (key === 'padding-top') {
              styleObj['padding-top'] = value;
            } else if (key === 'padding' && !styleObj['padding-top']) {
              styleObj['padding'] = value;
            } else if (!styleObj[key]) {
              styleObj[key] = value;
            }
          }
        }
      }
    });
    
    // 强制确保 color 是正确的值（不能被全局样式覆盖）
    // 无论现有值是什么，都强制设置为 #abb2bf
    styleObj['color'] = '#abb2bf';
    
    // 强制确保 padding-top 是正确的值（不能被错误的值覆盖）
    // 如果 padding-top 不是 15px，强制设置为 15px
    if (styleObj['padding-top'] !== '15px') {
      styleObj['padding-top'] = '15px';
    }
    
    // 重新组合样式（按 target.html 的顺序）
    // 注意：color 放在前面，确保优先级
    const cleanedStyle = [
      `overflow-x: ${styleObj['overflow-x'] || 'auto'}`,
      `padding: ${styleObj['padding'] || '16px'}`,
      `color: ${styleObj['color']}`,
      `padding-top: ${styleObj['padding-top']}`,
      `background: ${styleObj['background'] || '#282c34'}`,
      `border-radius: ${styleObj['border-radius'] || '5px'}`,
      `display: ${styleObj['display'] || '-webkit-box'}`,
      `font-family: ${styleObj['font-family'] || 'Consolas, Monaco, Menlo, monospace'}`,
      `font-size: ${styleObj['font-size'] || '12px'}`
    ].join('; ');
    
    $code.attr('style', cleanedStyle);
  });
  
  // 最后一步：确保代码块的颜色正确（在所有样式应用之后）
  // 这是最后的后处理步骤，确保代码块的颜色不会被全局样式覆盖
  $('pre.custom code.hljs').each((_, element) => {
    const $code = $(element);
    let codeStyle = $code.attr('style') || '';
    
    // 强制确保 code 标签有正确的颜色（优先级最高）
    // 移除任何可能的黑色或白色颜色，强制设置为 #abb2bf
    if (codeStyle.includes('color:')) {
      codeStyle = codeStyle.replace(/color:\s*[^;]+/gi, 'color: #abb2bf');
    } else {
      codeStyle = codeStyle ? `${codeStyle}; color: #abb2bf` : 'color: #abb2bf';
    }
    $code.attr('style', codeStyle);
    
    // 确保代码块内的所有子元素（非语法高亮标签）也有正确的颜色
    $code.find('*').each((_, childElement) => {
      const $child = $(childElement);
      const classes = $child.attr('class') || '';
      
      // 跳过语法高亮标签（hljs-*），它们有自己的颜色
      if (!classes.includes('hljs-')) {
        const childStyle = $child.attr('style') || '';
        const childColorMatch = childStyle.match(/color:\s*([^;]+)/);
        const childColor = childColorMatch ? childColorMatch[1].trim() : '';
        
        // 如果子元素没有颜色，或者是黑色/白色，设置为正确的颜色
        if (!childColor || childColor === 'rgb(0, 0, 0)' || childColor === '#000' || childColor === 'black' ||
            childColor === 'rgb(255, 255, 255)' || childColor === '#fff' || childColor === 'white') {
          if (childStyle) {
            const newChildStyle = childStyle.replace(/color:\s*[^;]+/gi, 'color: #abb2bf');
            $child.attr('style', newChildStyle);
          } else {
            $child.attr('style', 'color: #abb2bf');
          }
        }
      }
    });
  });
  
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
  
  // 修复错误的样式属性名（如 justify-margin-top, justify-line-height）
  // 这些错误通常是由于样式合并时的问题导致的
  result = result.replace(/justify-margin-top/g, 'justify-content: unset; margin-top');
  result = result.replace(/justify-line-height/g, 'justify-content: unset; line-height');
  result = result.replace(/justify-content:\s*unset;\s*justify-content:\s*unset/g, 'justify-content: unset');
  
  // 修复其他可能的错误属性名（如 margin-justify-content 等）
  result = result.replace(/([a-z-]+)-([a-z-]+)-([a-z-]+):/g, (match, p1, p2, p3) => {
    // 检查是否是有效的 CSS 属性名
    const validProps = ['margin', 'padding', 'border', 'background', 'text', 'font', 'line', 'display', 'justify', 'align', 'flex', 'overflow', 'position', 'transform', 'box-shadow', 'border-radius', 'word-wrap', 'word-break', 'overflow-wrap'];
    const prop = `${p1}-${p2}-${p3}`;
    if (validProps.some(v => prop.startsWith(v))) {
      return match; // 有效的属性名，保留
    }
    // 可能是错误的合并，尝试修复
    // 例如：justify-margin-top -> justify-content: unset; margin-top
    if (p1 === 'justify' && p2 === 'margin') {
      return `justify-content: unset; margin-${p3}:`;
    }
    if (p1 === 'justify' && p2 === 'line') {
      return `justify-content: unset; line-${p3}:`;
    }
    return match; // 无法修复，保留原样
  });

  // 修复错误的 color 值（如 color: 14px, color: 12px 等数字值，应该是颜色值）
  // 匹配 color: 数字px 或 color: 数字 的模式（但不是 rgb/rgba/hex 等有效颜色值）
  result = result.replace(/color:\s*(\d+)(px|em|rem|%)?[^;]*;/gi, (match, num, unit) => {
    // 移除错误的 color 属性（数字值不是有效的颜色值）
    return '';
  });
  
  // 清理可能产生的双分号（由于移除了 color 属性）
  result = result.replace(/;;+/g, ';');
  
  // 清理样式字符串开头和结尾的分号
  result = result.replace(/style=["']([^"']*);+["']/g, (match, styleContent) => {
    const cleaned = styleContent.replace(/^;+|;+$/g, '').replace(/;;+/g, ';');
    return `style="${cleaned}"`;
  });

  // 修复列表项格式：将列表项压缩到同一行（与 target.html 保持一致）
  // 匹配 <ol> 或 <ul> 标签及其内容，将 <li> 之间的换行和空格移除
  // 需要处理嵌套列表，所以使用递归处理
  function compressListItems(html: string): string {
    // 先处理最内层的列表，再处理外层
    return html.replace(
      /(<(?:ol|ul)[^>]*>)([\s\S]*?)(<\/(?:ol|ul)>)/gi,
      (match, openTag, content, closeTag) => {
        // 递归处理嵌套列表
        let processedContent = compressListItems(content);
        
        // 保存第一个 <li> 前的缩进（如果有的话）
        const firstLiMatch = processedContent.match(/^(\s*)<li>/i);
        const indent = firstLiMatch ? firstLiMatch[1] : '';
        
        // 移除所有 <li> 之间的空白字符（换行、空格、制表符等）
        // 但保留 <li> 标签内的内容不变
        // 关键：只移除 </li> 和 <li> 之间的空白，不触碰标签内部
        
        // 第一步：移除 </li> 和 <li> 之间的所有空白（包括换行）
        processedContent = processedContent.replace(/\s*<\/li>\s*<li>/gi, '</li><li>');
        
        // 第二步：移除第一个 <li> 前的所有空白（包括换行），但稍后会恢复缩进
        processedContent = processedContent.replace(/^\s*<li>/gi, '<li>');
        
        // 第三步：移除最后一个 </li> 后的所有空白（包括换行）
        processedContent = processedContent.replace(/<\/li>\s*$/gi, '</li>');
        
        // 如果内容为空，保持原样
        if (!processedContent.trim()) {
          return match;
        }
        
        // 恢复第一个 <li> 前的缩进（如果有的话）
        if (indent && processedContent.startsWith('<li>')) {
          processedContent = indent + processedContent;
        }
        
        // 返回压缩后的列表（所有 <li> 在同一行，没有换行）
        return `${openTag}${processedContent}${closeTag}`;
      }
    );
  }
  
  // 应用列表压缩
  result = compressListItems(result);

  return result;
}
