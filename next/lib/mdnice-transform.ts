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
  result = result.replace(/<\/div>\s*(?=<style>)/gi, '</section>');
  
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
      if (newCodeAttrs.includes('class=')) {
        if (!newCodeAttrs.includes('hljs')) {
          newCodeAttrs = newCodeAttrs.replace(/class=["']([^"']*)["']/, 'class="$1 hljs"');
        }
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
      
      // 添加 code.hljs 的默认样式
      const defaultCodeStyle = 'overflow-x: auto; padding: 16px; color: #abb2bf; padding-top: 15px; background: #282c34; border-radius: 5px; display: -webkit-box; font-family: Consolas, Monaco, Menlo, monospace; font-size: 12px;';
      let codeStyle = '';
      if (newCodeAttrs.includes('style=')) {
        const styleMatch = newCodeAttrs.match(/style=["']([^"']*)["']/);
        if (styleMatch) {
          codeStyle = `${styleMatch[1]}; ${defaultCodeStyle}`;
          newCodeAttrs = newCodeAttrs.replace(/style=["'][^"']*["']/, `style="${codeStyle}"`);
        } else {
          newCodeAttrs += ` style="${defaultCodeStyle}"`;
        }
      } else {
        newCodeAttrs += ` style="${defaultCodeStyle}"`;
      }
      
      // 处理代码内容：将换行转换为 <br>，空格转换为 &nbsp;
      let processedCodeContent = codeContent;
      // 按行处理，每行的前导空格转换为 &nbsp;
      const lines = processedCodeContent.split('\n');
      const processedLines = lines.map(line => {
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
      
      // 添加顶部装饰条
      const decoratorSpan = '<span style="display: block; background: url(https://files.mdnice.com/user/3441/876cad08-0422-409d-bb5a-08afec5da8ee.svg); height: 30px; width: 100%; background-size: 40px; background-repeat: no-repeat; background-color: #282c34; margin-bottom: -7px; border-radius: 5px; background-position: 10px 10px;"></span>';
      
      return `<pre${newPreAttrs}>${decoratorSpan}<code${newCodeAttrs}>${processedCodeContent}</code>${afterCode}</pre>`;
    }
  );
  
  // 4. 处理列表项 - 用 <section> 包裹内容
  result = result.replace(
    /<li([^>]*)>([^<]+(?:<[^>]+>[^<]*</[^>]+>)*[^<]*)<\/li>/gi,
    (match, attrs, content) => {
      // 如果已经有 section，跳过
      if (content.includes('<section')) {
        return match;
      }
      
      // 用 section 包裹内容
      return `<li${attrs}><section>${content}</section></li>`;
    }
  );
  
  // 5. 为其他元素添加 data-tool 属性
  result = result.replace(
    /<(p|ul|ol|blockquote)([^>]*)>/gi,
    (match, tag, attrs) => {
      if (attrs.includes('data-tool')) {
        return match;
      }
      return `<${tag}${attrs} data-tool="mdnice编辑器">`;
    }
  );
  
  // 6. 替换所有 <br/> 为 <br>（与 target.html 保持一致）
  result = result.replace(/<br\/>/g, '<br>');
  
  return result;
}

