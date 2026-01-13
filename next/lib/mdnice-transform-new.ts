/**
 * mdnice HTML 格式转换工具 (完全重构版本)
 * 完全使用 DOM 操作，不使用正则表达式
 * 
 * 转换流程：
 * 1. Markdown -> markdown-it -> HTML (基础 HTML)
 * 2. HTML -> transformToMdniceFormat -> mdnice 格式 HTML (添加 data-tool, 结构转换)
 * 3. HTML -> applyInlineStyles -> 内联样式 HTML (将 CSS 内联到元素)
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

export function transformToMdniceFormat(htmlContent: string): string {
  const $ = cheerio.load(htmlContent);

  // 1. 转换外层容器 <div id="nice"> -> <section id="nice" data-tool="mdnice编辑器" data-website="https://www.mdnice.com">
  $('#nice').each((_, element) => {
    const $section = $(element);
    if ($section.length && element.tagName === 'div') {
      // 创建新的 section 元素
      const $newSection = $('<section>');
      
      // 复制所有属性
      const attrs = element.attribs || {};
      Object.keys(attrs).forEach(key => {
        if (key !== 'id') {
          $newSection.attr(key, attrs[key]);
        }
      });
      
      // 设置必需的属性
      $newSection.attr('id', 'nice');
      $newSection.attr('data-tool', 'mdnice编辑器');
      $newSection.attr('data-website', 'https://www.mdnice.com');
      
      // 复制内容
      $newSection.html($section.html() || '');
      
      // 替换原元素
      $section.replaceWith($newSection);
    } else {
      // 如果已经是 section，只添加缺失的属性
      if (!$section.attr('data-tool')) {
        $section.attr('data-tool', 'mdnice编辑器');
      }
      if (!$section.attr('data-website')) {
        $section.attr('data-website', 'https://www.mdnice.com');
      }
    }
  });

  // 2. 处理标题（h1-h6）- 添加 prefix/content/suffix 结构
  for (let level = 1; level <= 6; level++) {
    $(`h${level}`).each((_, element) => {
      const $heading = $(element);
      
      // 如果已经有 content span，跳过
      if ($heading.find('span.content').length > 0) {
        return;
      }
      
      // 添加 data-tool 属性
      if (!$heading.attr('data-tool')) {
        $heading.attr('data-tool', 'mdnice编辑器');
      }
      
      // 提取纯文本内容（去除 HTML 标签）
      const textContent = $heading.text().trim();
      
      // 创建新的结构
      const $prefix = $('<span>').addClass('prefix').attr('style', 'display: none;');
      const $content = $('<span>').addClass('content').text(textContent);
      const $suffix = $('<span>').addClass('suffix').attr('style', 'display: none;');
      
      // 替换内容
      $heading.empty().append($prefix).append($content).append($suffix);
    });
  }

  // 3. 处理代码块 - 转换为 pre.custom 格式
  // 重要：使用 DOM 操作，确保只处理正确的代码块内容
  $('pre').each((_, element) => {
    const $pre = $(element);
    
    // 如果已经是 custom，跳过
    if ($pre.hasClass('custom')) {
      return;
    }
    
    // 重要：使用 DOM 操作检查代码块是否包含不应该在代码块中的元素
    // 如果 <pre> 的直接子元素或后代元素中包含 <h1>-<h6>、<ol>、<ul>、<table>、<blockquote>、<hr>、<p> 等标签
    // 说明代码块没有正确闭合，需要修复
    const $firstCode = $pre.find('code').first();
    const $invalidElements = $pre.find('h1, h2, h3, h4, h5, h6, ol, ul, table, blockquote, hr, p');
    
    if ($invalidElements.length > 0 && $firstCode.length > 0) {
      // 检查第一个无效元素是否在第一个 code 标签之后
      // 使用 DOM 遍历来检查
      let foundInvalidAfterCode = false;
      let foundCode = false;
      
      // 遍历所有子节点
      $pre.contents().each((_, node: any) => {
        if (node === $firstCode[0]) {
          foundCode = true;
        } else if (foundCode && node.type === 'tag') {
          const tagName = (node as any).tagName?.toLowerCase();
          if (tagName && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ol', 'ul', 'table', 'blockquote', 'hr', 'p'].includes(tagName)) {
            foundInvalidAfterCode = true;
            return false; // 中断遍历
          }
        }
      });
      
      if (foundInvalidAfterCode) {
        // 代码块包含了后续内容，需要修复
        // 只保留到第一个 code 标签结束的内容
        const $codeClone = $firstCode.clone(); // cheerio 的 clone() 默认就是深度克隆
        // 清空 <pre>，只保留 <code> 标签
        $pre.empty();
        $pre.append($codeClone);
      }
    } else if ($invalidElements.length > 0 && $firstCode.length === 0) {
      // 如果没有 <code> 标签但有无效元素，尝试提取纯文本
      const textContent = $pre.text();
      $pre.empty();
      const $newCode = $('<code>').addClass('hljs').text(textContent);
      $pre.append($newCode);
    }
    
    // 添加 custom 类
    $pre.addClass('custom');
    
    // 添加 data-tool 属性
    if (!$pre.attr('data-tool')) {
      $pre.attr('data-tool', 'mdnice编辑器');
    }
    
    // 添加 pre.custom 的默认样式
    const defaultPreStyle = 'border-radius: 5px; box-shadow: rgba(0, 0, 0, 0.55) 0px 2px 10px; text-align: left;';
    const existingPreStyle = $pre.attr('style') || '';
    $pre.attr('style', existingPreStyle ? `${existingPreStyle}; ${defaultPreStyle}` : defaultPreStyle);
    
    // 查找 code 标签（只查找直接子元素）
    const $code = $pre.children('code').first();
    if ($code.length === 0) {
      // 如果没有直接子元素 code，尝试查找所有 code
      const $codeAny = $pre.find('code').first();
      if ($codeAny.length === 0) {
        // 如果完全没有 code 标签，创建一个
        // 重要：使用 html() 而不是 text()，以保留所有内容（包括可能的 HTML 标签）
        const codeHtml = $pre.html() || $pre.text();
        $pre.empty();
        const $newCode = $('<code>').addClass('hljs');
        // 先设置 HTML 内容，然后再处理
        $newCode.html(codeHtml);
        $pre.append($newCode);
        processCodeContent($newCode);
      } else {
        // 使用找到的 code 标签
        $codeAny.removeClass().addClass('hljs');
        const defaultCodeStyle = 'overflow-x: auto; padding: 16px; color: #abb2bf; padding-top: 15px; background: #282c34; border-radius: 5px; display: -webkit-box; font-family: Consolas, Monaco, Menlo, monospace; font-size: 12px;';
        const existingCodeStyle = $codeAny.attr('style') || '';
        let cleanedStyle = existingCodeStyle
          .replace(/color:\s*\d+px[^;]*;/gi, '')
          .replace(/background:\s*\d+px[^;]*;/gi, '');
        $codeAny.attr('style', cleanedStyle ? `${cleanedStyle}; ${defaultCodeStyle}` : defaultCodeStyle);
        processCodeContent($codeAny);
        const decoratorSpan = $('<span>').attr('style', 'display: block; background: url(https://files.mdnice.com/user/3441/876cad08-0422-409d-bb5a-08afec5da8ee.svg); height: 30px; width: 100%; background-size: 40px; background-repeat: no-repeat; background-color: #282c34; margin-bottom: -7px; border-radius: 5px; background-position: 10px 10px;');
        $pre.prepend(decoratorSpan);
      }
    } else {
      // 确保 code 有 hljs 类
      $code.removeClass().addClass('hljs');
      
      // 添加 code.hljs 的默认样式
      const defaultCodeStyle = 'overflow-x: auto; padding: 16px; color: #abb2bf; padding-top: 15px; background: #282c34; border-radius: 5px; display: -webkit-box; font-family: Consolas, Monaco, Menlo, monospace; font-size: 12px;';
      const existingCodeStyle = $code.attr('style') || '';
      
      // 清理现有样式中的错误值
      let cleanedStyle = existingCodeStyle
        .replace(/color:\s*\d+px[^;]*;/gi, '')
        .replace(/background:\s*\d+px[^;]*;/gi, '');
      
      $code.attr('style', cleanedStyle ? `${cleanedStyle}; ${defaultCodeStyle}` : defaultCodeStyle);
      
      // 处理代码内容（只处理 <code> 标签内的内容）
      // 重要：在处理之前，确保代码内容被正确包含在 <code> 标签内
      processCodeContent($code);
      
      // 添加顶部装饰条
      const decoratorSpan = $('<span>').attr('style', 'display: block; background: url(https://files.mdnice.com/user/3441/876cad08-0422-409d-bb5a-08afec5da8ee.svg); height: 30px; width: 100%; background-size: 40px; background-repeat: no-repeat; background-color: #282c34; margin-bottom: -7px; border-radius: 5px; background-position: 10px 10px;');
      $pre.prepend(decoratorSpan);
    }
  });

  // 4. 处理列表项 - 用 <section> 包裹内容
  $('li').each((_, element) => {
    const $li = $(element);
    
    // 如果已经有 section，跳过
    if ($li.find('section').length > 0) {
      return;
    }
    
    // 检查内容是否为空或只有空白字符
    const textContent = $li.text().trim();
    const hasChildren = $li.children().length > 0;
    const htmlContent = ($li.html() || '').trim();
    
    // 如果内容为空，跳过处理
    if (!textContent && !hasChildren && !htmlContent) {
      return;
    }
    
    // 用 section 包裹内容
    const content = $li.html() || '';
    const $section = $('<section>').html(content);
    $li.empty().append($section);
  });
  
  // 4.1 移除所有空的 section 标签
  const emptySections: Element[] = [];
  $('section').each((_, element) => {
    const $section = $(element);
    const textContent = $section.text().trim();
    const hasChildren = $section.children().length > 0;
    const htmlContent = ($section.html() || '').trim();
    
    if (!textContent && !hasChildren && !htmlContent) {
      emptySections.push(element);
    }
  });
  emptySections.forEach(section => {
    $(section).remove();
  });
  
  // 4.2 移除空的列表项
  const emptyListItems: Element[] = [];
  $('li').each((_, element) => {
    const $li = $(element);
    const textContent = $li.text().trim();
    const hasChildren = $li.children().length > 0;
    const htmlContent = ($li.html() || '').trim();
    
    if (!textContent && !hasChildren && !htmlContent) {
      emptyListItems.push(element);
    }
  });
  emptyListItems.forEach(li => {
    $(li).remove();
  });

  // 5. 为其他元素添加 data-tool 属性
  $('p, ul, ol, blockquote, hr').each((_, element) => {
    const $el = $(element);
    if (!$el.attr('data-tool')) {
      $el.attr('data-tool', 'mdnice编辑器');
    }
  });

  // 6. 处理列表格式 - 移除 <ol> 和 <ul> 标签后的空白
  $('ol, ul').each((_, element) => {
    const $list = $(element);
    const children = $list.contents().toArray();
    
    // 移除开头的文本节点（空白字符）
    if (children.length > 0 && children[0].type === 'text') {
      const textNode = children[0] as any;
      const text = textNode.data || '';
      // 检查是否只包含空白字符（不使用正则表达式）
      let isOnlyWhitespace = true;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char !== ' ' && char !== '\n' && char !== '\r' && char !== '\t') {
          isOnlyWhitespace = false;
          break;
        }
      }
      if (isOnlyWhitespace) {
        $(textNode).remove();
      }
    }
  });
  
  // 移除 </li> 和下一个 <li> 之间的空白
  $('li').each((_, element) => {
    const $li = $(element);
    const nextSibling = element.nextSibling;
    if (nextSibling && (nextSibling as any).type === 'text') {
      const text = ((nextSibling as any).data || '');
      // 检查是否只包含空白字符（不使用正则表达式）
      let isOnlyWhitespace = true;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char !== ' ' && char !== '\n' && char !== '\r' && char !== '\t') {
          isOnlyWhitespace = false;
          break;
        }
      }
      if (isOnlyWhitespace) {
        $(nextSibling).remove();
      }
    }
  });

  // 修复 cheerio 可能转义的 HTML 实体（在代码块中）
  // 使用字符串操作而不是正则表达式
  $('pre.custom code.hljs').each((_, element) => {
    const $code = $(element);
    let html = $code.html() || '';
    
    // 修复被转义的 HTML 实体（使用字符串替换，不使用正则表达式）
    // 替换 &amp;nbsp; 为 &nbsp;
    html = html.split('&amp;nbsp;').join('&nbsp;');
    // 替换 &amp;lt;br&amp;gt; 为 <br>
    html = html.split('&amp;lt;br&amp;gt;').join('<br>');
    // 替换 &lt;br&gt; 为 <br>
    html = html.split('&lt;br&gt;').join('<br>');
    // 替换 &amp;#39; 为 '
    html = html.split('&amp;#39;').join("'");
    // 替换 &amp;quot; 为 "
    html = html.split('&amp;quot;').join('"');
    
    $code.html(html);
  });
  
  // 处理列表格式 - 移除 <ol> 和 <ul> 标签后的空白
  $('ol, ul').each((_, element) => {
    const $list = $(element);
    const children = $list.contents().toArray();
    
    // 移除开头的文本节点（空白字符）
    if (children.length > 0 && children[0].type === 'text') {
      const textNode = children[0] as any;
      const text = textNode.data || '';
      if (/^\s+$/.test(text)) {
        $(textNode).remove();
      }
    }
  });
  
  // 移除 </li> 和下一个 <li> 之间的空白文本节点
  $('li').each((_, element) => {
    const $li = $(element);
    const nextSibling = element.nextSibling;
    if (nextSibling && (nextSibling as any).type === 'text') {
      const text = ((nextSibling as any).data || '').trim();
      if (!text) {
        $(nextSibling).remove();
      }
    }
  });

  // 获取结果
  let result = $.html();
  
  // 修复 cheerio 可能添加的额外标签（如 <html><head><body>）
  // 使用 DOM 操作提取 body 内容
  const $final = cheerio.load(result);
  if ($final('html').length > 0) {
    const $body = $final('body');
    if ($body.length > 0) {
      const bodyContent = $body.html() || '';
      if (bodyContent) {
        result = bodyContent;
      }
    }
  }
  
  // 确保 section#nice 在最外层
  // 使用 DOM 操作提取 section#nice
  const $final2 = cheerio.load(result);
  const $niceSection = $final2('section#nice');
  if ($niceSection.length > 0) {
    // 获取 section#nice 的 HTML（包括标签本身）
    const sectionHtml = $final2.html($niceSection) || '';
    if (sectionHtml) {
      result = sectionHtml;
    }
  }
  
  return result;
}

/**
 * 处理代码块内容
 * 关键：代码块中的 \n 字面量应该保持为字面量，不应该转换为换行符
 * 只有实际的换行符才应该转换为 <br>
 */
function processCodeContent($code: cheerio.Cheerio<any>): void {
  // 重要：只处理 <code> 标签内的直接内容
  // 获取代码的原始 HTML 内容（可能包含语法高亮标签）
  // 使用 html() 而不是 text()，以保留所有内容（包括 HTML 标签和特殊字符）
  let originalHtml = $code.html() || '';
  
  // 如果 originalHtml 为空，尝试获取文本内容
  if (!originalHtml || originalHtml.trim() === '') {
    const text = $code.text();
    if (text) {
      const processed = processCodeText(text);
      $code.html(processed);
    }
    return;
  }
  
  // 重要：检查代码内容是否被正确转义
  // 如果代码中包含未转义的 < 或 >，可能会导致解析错误
  // 但 markdown-it 应该已经转义了这些字符（< -> &lt;, > -> &gt;）
  
  // 检查是否包含 HTML 标签（语法高亮）
  // 注意：我们需要区分真正的 HTML 标签和转义的字符（&lt; 和 &gt;）
  const hasHtmlTags = originalHtml.includes('<') && originalHtml.includes('>') && 
                      !originalHtml.includes('&lt;') && !originalHtml.includes('&gt;');
  
  if (hasHtmlTags) {
    // 如果已经有 HTML 标签（语法高亮），需要保护它们
    // 使用 cheerio 来解析，这样可以正确处理嵌套的 HTML 标签
    const $temp = cheerio.load(originalHtml, null, false);
    
    // 递归处理所有文本节点
    function processTextNodes($element: cheerio.Cheerio<any>): void {
      $element.contents().each((_, node: any) => {
        if (node.type === 'text') {
          const text = node.data || '';
          if (text) {
            // 处理文本：将换行转换为 <br>，空格转换为 &nbsp;
            const processed = processCodeText(text);
            // 将处理后的文本（可能包含 <br> 和 &nbsp;）插入到 DOM 中
            // 注意：cheerio 会自动转义 HTML，所以我们需要直接操作节点
            node.data = processed;
          }
        } else if (node.type === 'tag') {
          // 递归处理子节点
          processTextNodes($temp(node));
        }
      });
    }
    
    processTextNodes($temp.root());
    
    // 获取处理后的 HTML
    originalHtml = $temp.html() || originalHtml;
  } else {
    // 如果没有 HTML 标签，直接处理文本
    // 但需要先检查是否有转义的字符
    // 如果有转义的字符（&lt;、&gt;），我们需要先解码，然后处理，再编码
    let text = originalHtml;
    
    // 解码转义的字符（但保留 &nbsp; 等）
    text = text.split('&lt;').join('<');
    text = text.split('&gt;').join('>');
    text = text.split('&amp;').join('&');
    
    // 处理文本
    const processed = processCodeText(text);
    
    // 重新编码特殊字符（但保留 <br> 和 &nbsp;）
    let finalHtml = processed;
    // 将 < 和 > 转义（但保留 <br> 标签）
    finalHtml = finalHtml.split('<br>').join('__BR_TAG__');
    finalHtml = finalHtml.split('<').join('&lt;');
    finalHtml = finalHtml.split('>').join('&gt;');
    finalHtml = finalHtml.split('__BR_TAG__').join('<br>');
    // 将 & 转义（但保留 &nbsp;、&lt;、&gt;）
    finalHtml = finalHtml.split('&nbsp;').join('__NBSP__');
    finalHtml = finalHtml.split('&lt;').join('__LT__');
    finalHtml = finalHtml.split('&gt;').join('__GT__');
    finalHtml = finalHtml.split('&').join('&amp;');
    finalHtml = finalHtml.split('__NBSP__').join('&nbsp;');
    finalHtml = finalHtml.split('__LT__').join('&lt;');
    finalHtml = finalHtml.split('__GT__').join('&gt;');
    
    originalHtml = finalHtml;
  }
  
  // 直接设置 HTML 内容
  $code.html(originalHtml);
}

/**
 * 处理代码文本
 * 关键点：
 * 1. \n 字面量（字符串中的 \n，即反斜杠+n）应该保持为字面量，显示为 \n
 * 2. 实际的换行符（字符码 10，即真正的换行）应该转换为 <br>
 * 3. 空格应该转换为 &nbsp;
 */
function processCodeText(text: string): string {
  // 使用占位符临时替换 \n 字面量
  const literalNewlinePlaceholder = '__LITERAL_NEWLINE__';
  const literalNewlines: string[] = [];
  let literalIndex = 0;
  
  // 匹配转义序列字面量：\n, \r, \t（但不匹配实际的换行符）
  // 不使用正则表达式，使用字符串查找
  let protectedText = text;
  let i = 0;
  while (i < protectedText.length - 1) {
    if (protectedText[i] === '\\') {
      const nextChar = protectedText[i + 1];
      if (nextChar === 'n' || nextChar === 'r' || nextChar === 't' || nextChar === '\\') {
        const match = protectedText.substring(i, i + 2);
        const placeholder = `${literalNewlinePlaceholder}_${literalIndex}__`;
        literalNewlines[literalIndex] = match;
        literalIndex++;
        protectedText = protectedText.substring(0, i) + placeholder + protectedText.substring(i + 2);
        i += placeholder.length;
        continue;
      }
    }
    i++;
  }
  
  // 现在处理实际的换行符（字符码 10）
  // 按行分割（不使用正则表达式）
  const lines: string[] = [];
  let currentLine = '';
  for (let i = 0; i < protectedText.length; i++) {
    const char = protectedText[i];
    if (char === '\n' || (char === '\r' && protectedText[i + 1] === '\n')) {
      lines.push(currentLine);
      currentLine = '';
      if (char === '\r' && protectedText[i + 1] === '\n') {
        i++; // 跳过 \n
      }
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  
  const processedLines = lines.map((line) => {
    // 恢复转义序列字面量
    literalNewlines.forEach((literal, index) => {
      const placeholder = `${literalNewlinePlaceholder}_${index}__`;
      line = line.split(placeholder).join(literal);
    });
    
    // 计算前导空格数（不使用 trimStart）
    let leadingSpaces = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ' || line[i] === '\t') {
        leadingSpaces++;
      } else {
        break;
      }
    }
    
    // 处理前导空格
    let processedLine = '&nbsp;'.repeat(leadingSpaces) + line.substring(leadingSpaces);
    
    // 处理行内的其他空格（不使用正则表达式）
    processedLine = processedLine.split(' ').join('&nbsp;');
    
    return processedLine;
  });
  
  // 重新组合，行间用 <br> 连接
  return processedLines.join('<br>');
}
