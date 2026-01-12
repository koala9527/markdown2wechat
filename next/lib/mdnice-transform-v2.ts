/**
 * mdnice HTML 格式转换工具 (重构版本)
 * 使用 DOM 解析而非正则表达式，更可靠地处理 HTML 结构
 * 
 * 转换流程：
 * 1. Markdown -> markdown-it -> HTML (基础 HTML)
 * 2. HTML -> transformToMdniceFormat -> mdnice 格式 HTML (添加 data-tool, 结构转换)
 * 3. HTML -> applyInlineStyles -> 内联样式 HTML (将 CSS 内联到元素)
 */

import * as cheerio from 'cheerio';

export function transformToMdniceFormat(htmlContent: string): string {
  // 重要：在解析之前，先验证代码块是否正确闭合
  // 检查是否有未闭合的 <pre> 或 <code> 标签
  const preMatches = htmlContent.match(/<pre[^>]*>/gi) || [];
  const preCloseMatches = htmlContent.match(/<\/pre>/gi) || [];
  const codeMatches = htmlContent.match(/<code[^>]*>/gi) || [];
  const codeCloseMatches = htmlContent.match(/<\/code>/gi) || [];
  
  if (preMatches.length !== preCloseMatches.length) {
    console.warn(`警告：<pre> 标签数量不匹配 - 开始: ${preMatches.length}, 结束: ${preCloseMatches.length}`);
  }
  if (codeMatches.length !== codeCloseMatches.length) {
    console.warn(`警告：<code> 标签数量不匹配 - 开始: ${codeMatches.length}, 结束: ${codeCloseMatches.length}`);
  }
  
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
  // 重要：只处理 <pre> 标签内的内容，不要包含外部内容
  // 先获取所有 <pre> 标签，确保它们都是独立的
  const $allPre = $('pre');
  $allPre.each((_, element) => {
    const $pre = $(element);
    
    // 如果已经是 custom，跳过
    if ($pre.hasClass('custom')) {
      return;
    }
    
    // 重要：检查 <pre> 标签是否包含后续的 HTML 标签（说明解析错误）
    // 如果 <pre> 的内容包含了 <h3>、<ol>、<ul> 等标签，说明代码块没有正确闭合
    const preHtml = $pre.html() || '';
    if (preHtml.match(/<(h[1-6]|ol|ul|table|blockquote|hr)[\s>]/i)) {
      console.warn('警告：代码块可能包含后续内容，尝试修复...');
      // 尝试找到第一个 </code> 标签，只保留到那里
      const codeEndIndex = preHtml.indexOf('</code>');
      if (codeEndIndex > 0) {
        const validContent = preHtml.substring(0, codeEndIndex + 7); // 7 是 '</code>' 的长度
        $pre.html(validContent);
      }
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
    
    // 查找 code 标签（只查找直接子元素，不查找嵌套的 code）
    const $code = $pre.children('code').first();
    if ($code.length === 0) {
      // 如果没有 code 标签，尝试查找所有 code（可能是嵌套的）
      const $codeAny = $pre.find('code').first();
      if ($codeAny.length === 0) {
        // 如果完全没有 code 标签，创建一个
        const codeText = $pre.text();
        $pre.empty();
        const $newCode = $('<code>').addClass('hljs').text(codeText);
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
    
    // 用 section 包裹内容
    const content = $li.html() || '';
    const $section = $('<section>').html(content);
    $li.empty().append($section);
  });

  // 5. 为其他元素添加 data-tool 属性
  $('p, ul, ol, blockquote, hr').each((_, element) => {
    const $el = $(element);
    if (!$el.attr('data-tool')) {
      $el.attr('data-tool', 'mdnice编辑器');
    }
  });

  // 6. 替换所有 <br/> 为 <br>（与 target.html 保持一致）
  $('br').each((_, element) => {
    const $br = $(element);
    if ($br[0].tagName === 'br') {
      // cheerio 会自动处理，但确保格式一致
    }
  });

  // 获取结果
  let result = $.html();
  
  // 修复 cheerio 可能添加的额外标签（如 <html><head><body>）
  if (result.includes('<html>')) {
    const bodyMatch = result.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      result = bodyMatch[1];
    }
  }
  
  // 确保 section#nice 在最外层
  // cheerio 的 html() 方法会返回完整的 HTML，我们需要提取 section#nice
  const sectionMatch = result.match(/<section[^>]*id=["']nice["'][^>]*>([\s\S]*)<\/section>/i);
  if (sectionMatch) {
    result = sectionMatch[0];
  }
  
  // 修复 cheerio 可能转义的 HTML 实体（在代码块中）
  // 注意：只在 <pre><code> 标签内修复，避免影响其他内容
  // 使用更精确的匹配，确保只匹配 <pre> 内的 <code> 标签
  // 先找到所有 <pre> 标签，然后处理其中的 <code> 标签
  result = result.replace(/(<pre[^>]*>)([\s\S]*?)(<\/pre>)/gi, (match, preOpen, preContent, preClose) => {
    // 在 <pre> 内容中查找 <code> 标签
    const codeMatch = preContent.match(/(<code[^>]*>)([\s\S]*?)(<\/code>)/i);
    if (codeMatch) {
      const [, codeOpen, codeContent, codeClose] = codeMatch;
      // 修复被转义的 &nbsp; 和 <br>（只在代码内容中）
      let fixedCodeContent = codeContent
        .replace(/&amp;nbsp;/g, '&nbsp;')
        .replace(/&amp;lt;br&amp;gt;/g, '<br>')
        .replace(/&lt;br&gt;/g, '<br>')
        .replace(/&amp;#39;/g, "'")
        .replace(/&amp;quot;/g, '"');
      // 替换 <pre> 内容中的 <code> 部分
      const fixedPreContent = preContent.replace(/(<code[^>]*>)([\s\S]*?)(<\/code>)/i, codeOpen + fixedCodeContent + codeClose);
      return preOpen + fixedPreContent + preClose;
    }
    return match;
  });
  
  // 替换 <br/> 为 <br>
  result = result.replace(/<br\s*\/>/gi, '<br>');
  
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
  // 注意：$code.html() 只会获取 <code> 标签内的内容，不会包含外部内容
  const originalHtml = $code.html() || '';
  
  // 如果 originalHtml 为空，尝试获取文本内容
  if (!originalHtml) {
    const text = $code.text();
    if (text) {
      const processed = processCodeText(text);
      $code.html(processed);
    }
    return;
  }
  
  // 检查是否包含 HTML 标签（语法高亮）
  const hasHtmlTags = /<[^>]+>/.test(originalHtml);
  
  if (hasHtmlTags) {
    // 如果已经有 HTML 标签（语法高亮），需要保护它们
    // 方法：使用正则表达式分割 HTML 标签和文本，分别处理
    
    // 使用正则表达式提取所有 HTML 标签和文本
    const parts: Array<{ type: 'text' | 'tag'; content: string }> = [];
    let lastIndex = 0;
    const tagRegex = /<[^>]+>/g;
    let match;
    
    while ((match = tagRegex.exec(originalHtml)) !== null) {
      // 添加标签前的文本
      if (match.index > lastIndex) {
        const text = originalHtml.substring(lastIndex, match.index);
        if (text) {
          parts.push({ type: 'text', content: text });
        }
      }
      // 添加标签
      parts.push({ type: 'tag', content: match[0] });
      lastIndex = match.index + match[0].length;
    }
    
    // 添加剩余的文本
    if (lastIndex < originalHtml.length) {
      const text = originalHtml.substring(lastIndex);
      if (text) {
        parts.push({ type: 'text', content: text });
      }
    }
    
    // 处理文本部分：将换行转换为 <br>，空格转换为 &nbsp;
    // 但保持 HTML 标签不变
    const processedParts = parts.map(part => {
      if (part.type === 'tag') {
        return part.content; // 保持标签不变
      } else {
        // 处理文本：将换行转换为 <br>，空格转换为 &nbsp;
        return processCodeText(part.content);
      }
    });
    
    // 重新组合
    const processedHtml = processedParts.join('');
    
    // 直接设置 HTML
    // 注意：cheerio 在设置 HTML 时可能会转义 HTML 实体
    // 我们会在最后统一修复（在 transformToMdniceFormat 函数的最后）
    $code.html(processedHtml);
  } else {
    // 如果没有 HTML 标签，直接处理文本
    const text = $code.text();
    const processed = processCodeText(text);
    
    // 直接设置 HTML 内容（包含 <br> 和 &nbsp;）
    // 注意：cheerio 可能会转义，我们会在最后统一修复
    $code.html(processed);
  }
}

/**
 * 处理代码文本
 * 关键点：
 * 1. \n 字面量（字符串中的 \n，即反斜杠+n）应该保持为字面量，显示为 \n
 * 2. 实际的换行符（字符码 10，即真正的换行）应该转换为 <br>
 * 3. 空格应该转换为 &nbsp;
 * 
 * 注意：markdown-it 在解析代码块时，会将代码内容转义（< -> &lt;, > -> &gt;），
 * 但 \n 字面量会保持为两个字符：反斜杠 + n
 * 
 * 在代码块中：
 * - 实际的换行符（字符码 10）是代码块中的真实换行
 * - \n 字面量（两个字符：反斜杠 + n）是代码内容的一部分，应该保持为字面量
 */
function processCodeText(text: string): string {
  // 重要：我们需要区分：
  // 1. 实际的换行符（字符码 10，\n 字符）-> 转换为 <br>
  // 2. \n 字面量（两个字符：反斜杠 + n）-> 保持为 \n
  
  // 首先，保护 \n 字面量（反斜杠 + n）
  // 在代码块中，\n 字面量是 "\\n"（在字符串中是两个字符：反斜杠 + n）
  // 但在 markdown-it 解析后，它可能已经是 "\n"（两个字符）或 "\\n"（三个字符，取决于转义）
  // 我们需要匹配反斜杠后跟 n/r/t 的模式，但不匹配实际的换行符
  
  // 使用占位符临时替换 \n 字面量
  const literalNewlinePlaceholder = '__LITERAL_NEWLINE__';
  const literalNewlines: string[] = [];
  let literalIndex = 0;
  
  // 匹配转义序列字面量：\n, \r, \t（但不匹配实际的换行符）
  // 注意：在字符串中，我们需要匹配 "\\n"（反斜杠 + n），而不是实际的换行符
  // 但是，在 markdown-it 解析后，代码内容中的 \n 字面量可能已经是 "\n"（两个字符）
  // 所以我们需要小心处理
  
  // 方法：先找到所有反斜杠，然后判断它后面是否跟着 n/r/t
  // 但要注意，实际的换行符是单个字符（字符码 10），不是两个字符
  let protectedText = text.replace(/\\([nrt\\])/g, (match, char) => {
    const placeholder = `${literalNewlinePlaceholder}_${literalIndex}__`;
    literalNewlines[literalIndex] = match; // 保存原始字面量，如 "\n", "\r", "\t", "\\"
    literalIndex++;
    return placeholder;
  });
  
  // 现在处理实际的换行符（字符码 10）
  // 按行分割（使用实际的换行符）
  const lines = protectedText.split(/\r?\n/);
  
  const processedLines = lines.map((line) => {
    // 恢复转义序列字面量
    literalNewlines.forEach((literal, index) => {
      line = line.replace(`${literalNewlinePlaceholder}_${index}__`, literal);
    });
    
    // 计算前导空格数
    const leadingSpaces = line.length - line.trimStart().length;
    
    // 处理前导空格
    let processedLine = '&nbsp;'.repeat(leadingSpaces) + line.substring(leadingSpaces);
    
    // 处理行内的其他空格
    processedLine = processedLine.replace(/ /g, '&nbsp;');
    
    return processedLine;
  });
  
  // 重新组合，行间用 <br> 连接
  return processedLines.join('<br>');
}

