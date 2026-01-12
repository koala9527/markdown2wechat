/**
 * mdnice HTML 格式转换工具
 * 将标准 Markdown 转换的 HTML 转换为 mdnice 编辑器生成的格式
 */

export function transformToMdniceFormat(htmlContent: string): string {
  // 使用正则表达式进行转换（因为 Node.js 环境可能没有 DOM 解析库）
  
  let result = htmlContent;
  
  // 1. 转换外层容器 <div id="nice"> -> <section id="nice" data-tool="mdnice编辑器" data-website="https://www.mdnice.com">
  result = result.replace(
    /<div\s+id=["']nice["']([^>]*)>/gi,
    '<section id="nice" data-tool="mdnice编辑器" data-website="https://www.mdnice.com"$1>'
  );
  // 替换所有 </div> 为 </section>（在 section#nice 的情况下）
  // 使用更精确的匹配，确保只替换对应的结束标签
  result = result.replace(/<\/div>\s*(?=<style>)/gi, '</section>');
  // 也替换最后的 </div>
  result = result.replace(/<\/div>\s*$/gi, '</section>');
  
  // 2. 处理标题（h1-h6）- 添加 prefix/content/suffix 结构
  for (let level = 1; level <= 6; level++) {
    const headingRegex = new RegExp(
      `<h${level}([^>]*)>([^<]+(?:<[^>]+>[^<]*</[^>]+>)*[^<]*)</h${level}>`,
      'gi'
    );
    
    result = result.replace(headingRegex, (match, attrs, content) => {
      // 如果已经有 content span，跳过
      if (match.includes('class="content"')) {
        return match;
      }
      
      // 提取纯文本内容（去除 HTML 标签）
      const textContent = content.replace(/<[^>]+>/g, '').trim();
      
      // 添加 data-tool 属性
      let newAttrs = attrs;
      if (!newAttrs.includes('data-tool')) {
        newAttrs += ' data-tool="mdnice编辑器"';
      }
      
      return `<h${level}${newAttrs}><span class="prefix" style="display: none;"></span><span class="content">${textContent}</span><span class="suffix" style="display: none;"></span></h${level}>`;
    });
  }
  
  // 3. 处理代码块 - 转换为 pre.custom 格式
  result = result.replace(
    /<pre([^>]*)>([\s\S]*?)<code([^>]*)>([\s\S]*?)<\/code>([\s\S]*?)<\/pre>/gi,
    (match, preAttrs, beforeCode, codeAttrs, codeContent, afterCode) => {
      // 如果已经是 custom，跳过
      if (preAttrs.includes('class="custom"') || preAttrs.includes("class='custom'")) {
        return match;
      }
      
      // 添加 custom 类
      let newPreAttrs = preAttrs;
      if (newPreAttrs.includes('class=')) {
        newPreAttrs = newPreAttrs.replace(/class=["']([^"']*)["']/, 'class="$1 custom"');
      } else {
        newPreAttrs += ' class="custom"';
      }
      
      if (!newPreAttrs.includes('data-tool')) {
        newPreAttrs += ' data-tool="mdnice编辑器"';
      }
      
      // 确保 code 有 hljs 类
      let newCodeAttrs = codeAttrs;
      // 确保 code 的 class 只有 hljs（移除 language-xxx）
      if (newCodeAttrs.includes('class=')) {
        // 移除所有 class，只保留 hljs
        newCodeAttrs = newCodeAttrs.replace(/class=["'][^"']*["']/, 'class="hljs"');
      } else {
        newCodeAttrs += ' class="hljs"';
      }
      
      // 添加 pre.custom 的默认样式（这些样式不在主题 CSS 中，是 mdnice 默认的）
      const defaultPreStyle = 'border-radius: 5px; box-shadow: rgba(0, 0, 0, 0.55) 0px 2px 10px; text-align: left;';
      let preStyle = '';
      if (newPreAttrs.includes('style=')) {
        // 提取现有样式
        const styleMatch = newPreAttrs.match(/style=["']([^"']*)["']/);
        if (styleMatch) {
          preStyle = `${styleMatch[1]}; ${defaultPreStyle}`;
          newPreAttrs = newPreAttrs.replace(/style=["'][^"']*["']/, `style="${preStyle}"`);
        } else {
          newPreAttrs += ` style="${defaultPreStyle}"`;
        }
      } else {
        newPreAttrs += ` style="${defaultPreStyle}"`;
      }
      
      // 添加 code.hljs 的默认样式（注意：与 target.html 保持一致，只保留必要的样式）
      // target.html 中的 code 样式更简洁，只包含：overflow-x, padding, color, padding-top, background, border-radius, display, font-family, font-size
      const defaultCodeStyle = 'overflow-x: auto; padding: 16px; color: #abb2bf; padding-top: 15px; background: #282c34; border-radius: 5px; display: -webkit-box; font-family: Consolas, Monaco, Menlo, monospace; font-size: 12px;';
      let codeStyle = '';
      if (newCodeAttrs.includes('style=')) {
        const styleMatch = newCodeAttrs.match(/style=["']([^"']*)["']/);
        if (styleMatch) {
          // 先清理现有样式中的错误值（如 color: 14px 等）
          let existingStyle = styleMatch[1];
          // 移除明显错误的 color 值（如 color: 14px, color: 12px 等数字值）
          existingStyle = existingStyle.replace(/color:\s*\d+px[^;]*;/gi, '');
          // 移除明显错误的 background 值（如 background: 14px 等）
          existingStyle = existingStyle.replace(/background:\s*\d+px[^;]*;/gi, '');
          // 合并：现有样式（已清理）+ 默认样式（会覆盖）
          codeStyle = `${existingStyle}; ${defaultCodeStyle}`;
          newCodeAttrs = newCodeAttrs.replace(/style=["'][^"']*["']/, `style="${codeStyle}"`);
        } else {
          newCodeAttrs += ` style="${defaultCodeStyle}"`;
        }
      } else {
        newCodeAttrs += ` style="${defaultCodeStyle}"`;
      }
      
      // 处理代码内容：将换行转换为 <br>，空格转换为 &nbsp;
      // 注意：如果代码内容中已经有 HTML 标签（如语法高亮标签），需要保护它们
      let processedCodeContent = codeContent;
      
      // 首先处理转义字符：将字符串字面量的转义字符转换为实际字符
      // 例如：\n -> 实际换行符，\t -> 制表符，\\ -> 反斜杠
      // 注意：需要小心处理，避免破坏已有的 HTML 标签
      processedCodeContent = processedCodeContent
        // 先处理双反斜杠（转义的反斜杠），避免后续处理时误判
        .replace(/\\\\/g, '\u0001__BACKSLASH__\u0001')
        // 将 \n 转换为实际换行符
        .replace(/\\n/g, '\n')
        // 将 \t 转换为制表符（或空格）
        .replace(/\\t/g, '    ') // 4个空格代替制表符
        // 将 \r 转换为回车符（通常与 \n 一起使用）
        .replace(/\\r/g, '')
        // 恢复转义的反斜杠
        .replace(/\u0001__BACKSLASH__\u0001/g, '\\');
      
      // 检查是否包含 HTML 标签（语法高亮）
      const hasHtmlTags = /<[^>]+>/.test(processedCodeContent);
      
      if (hasHtmlTags) {
        // 如果已经有 HTML 标签，需要更小心地处理
        // 使用临时标记保护 HTML 标签
        const tagPlaceholders: string[] = [];
        let tagIndex = 0;
        
        // 用占位符替换所有 HTML 标签
        processedCodeContent = processedCodeContent.replace(/<[^>]+>/g, (match: string) => {
          const placeholder = `__TAG_${tagIndex}__`;
          tagPlaceholders[tagIndex] = match;
          tagIndex++;
          return placeholder;
        });
        
        // 现在处理纯文本部分：将换行转换为 <br>，空格转换为 &nbsp;
        const lines = processedCodeContent.split('\n');
        const processedLines = lines.map((line: string) => {
          // 计算前导空格数（但跳过占位符）
          let leadingSpaces = 0;
          for (let i = 0; i < line.length; i++) {
            if (line[i] === ' ') {
              leadingSpaces++;
            } else if (line.substring(i).startsWith('__TAG_')) {
              // 跳过占位符
              const match = line.substring(i).match(/^__TAG_\d+__/);
              if (match) {
                i += match[0].length - 1;
                continue;
              }
            } else {
              break;
            }
          }
          
          if (leadingSpaces > 0) {
            // 前导空格转换为 &nbsp;
            return '&nbsp;'.repeat(leadingSpaces) + line.substring(leadingSpaces);
          }
          return line;
        });
        
        // 重新组合，行间用 <br> 连接
        processedCodeContent = processedLines.join('<br>');
        // 行内的其他空格也转换为 &nbsp;（但不在占位符内）
        processedCodeContent = processedCodeContent.replace(/ /g, '&nbsp;');
        
        // 恢复 HTML 标签
        tagPlaceholders.forEach((tag, index) => {
          processedCodeContent = processedCodeContent.replace(`__TAG_${index}__`, tag);
        });
      } else {
        // 如果没有 HTML 标签，使用原来的简单处理方式
        const lines = processedCodeContent.split('\n');
        const processedLines = lines.map((line: string) => {
          // 计算前导空格数
          const leadingSpaces = line.length - line.trimStart().length;
          if (leadingSpaces > 0) {
            // 前导空格转换为 &nbsp;
            return '&nbsp;'.repeat(leadingSpaces) + line.substring(leadingSpaces);
          }
          return line;
        });
        
        // 重新组合，行间用 <br> 连接
        processedCodeContent = processedLines.join('<br>');
        // 行内的其他空格也转换为 &nbsp;
        processedCodeContent = processedCodeContent.replace(/ /g, '&nbsp;');
      }
      
      // 添加顶部装饰条（注意：不要添加 line-height，与 target.html 保持一致）
      const decoratorSpan = '<span style="display: block; background: url(https://files.mdnice.com/user/3441/876cad08-0422-409d-bb5a-08afec5da8ee.svg); height: 30px; width: 100%; background-size: 40px; background-repeat: no-repeat; background-color: #282c34; margin-bottom: -7px; border-radius: 5px; background-position: 10px 10px;"></span>';
      
      return `<pre${newPreAttrs}>${decoratorSpan}<code${newCodeAttrs}>${processedCodeContent}</code>${afterCode}</pre>`;
    }
  );
  
  // 4. 处理列表项 - 用 <section> 包裹内容
  result = result.replace(
    /<li([^>]*)>([\s\S]*?)<\/li>/gi,
    (match, attrs, content) => {
      // 如果已经有 section，跳过
      if (content.includes('<section')) {
        return match;
      }
      
      // 用 section 包裹内容
      return `<li${attrs}><section>${content}</section></li>`;
    }
  );
  
  // 5. 为其他元素添加 data-tool 属性（pre 标签也需要 data-tool，与 target.html 保持一致）
  result = result.replace(
    /<(p|ul|ol|blockquote)([^>]*)>/gi,
    (match, tag, attrs) => {
      if (attrs.includes('data-tool')) {
        return match;
      }
      return `<${tag}${attrs} data-tool="mdnice编辑器">`;
    }
  );
  
  // pre 标签的 data-tool 属性已经在代码块处理时添加，不需要移除
  
  // 6. 替换所有 <br/> 为 <br>（与 target.html 保持一致）
  result = result.replace(/<br\/>/g, '<br>');
  
  return result;
}

