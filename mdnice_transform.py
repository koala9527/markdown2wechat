"""
mdnice HTML 格式转换工具
将标准 Markdown 转换的 HTML 转换为 mdnice 编辑器生成的格式
"""
import re
from bs4 import BeautifulSoup


def transform_to_mdnice_format(html_content: str) -> str:
    """
    将标准 Markdown 转换的 HTML 转换为 mdnice 格式
    
    主要转换：
    1. <div id="nice"> -> <section id="nice" data-tool="mdnice编辑器" data-website="https://www.mdnice.com">
    2. 标题添加 prefix/content/suffix 结构
    3. 代码块转换为 pre.custom 格式（带顶部装饰条）
    4. 列表项内容用 <section> 包裹
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 1. 转换外层容器
    nice_div = soup.find('div', id='nice')
    if nice_div:
        nice_div.name = 'section'
        nice_div['data-tool'] = 'mdnice编辑器'
        nice_div['data-website'] = 'https://www.mdnice.com'
    
    # 2. 处理标题（h1-h6）
    for level in range(1, 7):
        for heading in soup.find_all(f'h{level}'):
            # 如果已经有 content span，跳过
            if heading.find('span', attrs={'class': 'content'}):
                continue
            
            # 保存标题内部的所有内容（包括 HTML 标签）
            heading_inner_html = ''.join(str(child) for child in heading.children)
            
            # 清空标题内容
            heading.clear()
            
            # 添加 prefix/content/suffix 结构
            prefix_span = soup.new_tag('span', attrs={'class': 'prefix'}, style='display: none;')
            content_span = soup.new_tag('span', attrs={'class': 'content'})
            # 将原始 HTML 内容添加到 content span 中
            content_span.append(BeautifulSoup(heading_inner_html, 'html.parser'))
            suffix_span = soup.new_tag('span', attrs={'class': 'suffix'}, style='display: none;')
            
            heading.append(prefix_span)
            heading.append(content_span)
            heading.append(suffix_span)
            
            # 添加 data-tool 属性
            heading['data-tool'] = 'mdnice编辑器'
    
    # 3. 处理代码块
    for pre in soup.find_all('pre'):
        # 跳过已经是 custom 的代码块
        if 'custom' in pre.get('class', []):
            continue
        
        # 添加 custom 类
        if pre.get('class'):
            pre['class'].append('custom')
        else:
            pre['class'] = ['custom']
        
        pre['data-tool'] = 'mdnice编辑器'
        
        # 添加 pre.custom 的默认样式（这些样式不在主题 CSS 中，是 mdnice 默认的）
        default_pre_style = (
            'border-radius: 5px; '
            'box-shadow: rgba(0, 0, 0, 0.55) 0px 2px 10px; '
            'text-align: left;'
        )
        existing_pre_style = pre.get('style', '')
        if existing_pre_style:
            pre['style'] = f'{existing_pre_style}; {default_pre_style}'
        else:
            pre['style'] = default_pre_style
        
        # 查找 code 标签
        code = pre.find('code')
        if code:
            # 确保 code 有 hljs 类
            if code.get('class'):
                if 'hljs' not in code.get('class', []):
                    code['class'].append('hljs')
            else:
                code['class'] = ['hljs']
            
            # 添加 code.hljs 的默认样式（这些样式不在主题 CSS 中，是 mdnice 默认的）
            default_code_style = (
                'overflow-x: auto; '
                'padding: 16px; '
                'color: #abb2bf; '
                'padding-top: 15px; '
                'background: #282c34; '
                'border-radius: 5px; '
                'display: -webkit-box; '
                'font-family: Consolas, Monaco, Menlo, monospace; '
                'font-size: 12px;'
            )
            existing_code_style = code.get('style', '')
            if existing_code_style:
                code['style'] = f'{existing_code_style}; {default_code_style}'
            else:
                code['style'] = default_code_style
            
            # 处理代码内容：将换行转换为 <br>，空格转换为 &nbsp;
            code_text = code.get_text()
            # 按行处理，每行的前导空格转换为 &nbsp;
            lines = code_text.split('\n')
            processed_lines = []
            for line in lines:
                # 计算前导空格数
                leading_spaces = len(line) - len(line.lstrip(' '))
                if leading_spaces > 0:
                    # 前导空格转换为 &nbsp;
                    processed_line = '&nbsp;' * leading_spaces + line[leading_spaces:]
                else:
                    processed_line = line
                processed_lines.append(processed_line)
            
            # 重新组合，行间用 <br> 连接
            code_text_processed = '<br>'.join(processed_lines)
            # 行内的其他空格也转换为 &nbsp;（除了已经转换的前导空格）
            # 这里简化处理：将所有剩余空格转换为 &nbsp;
            code_text_processed = code_text_processed.replace(' ', '&nbsp;')
            
            # 清空 code 内容并重新设置
            code.clear()
            # 使用字符串直接插入，避免 BeautifulSoup 自动转换 <br> 为 <br/>
            # 将 <br> 替换为特殊标记，然后手动处理
            code_text_final = code_text_processed.replace('<br>', '___BR_TAG___')
            code_soup = BeautifulSoup(code_text_final, 'html.parser')
            # 将特殊标记替换回 <br>（非自闭合）
            code_str = str(code_soup).replace('___BR_TAG___', '<br>')
            code.append(BeautifulSoup(code_str, 'html.parser'))
            
            # 在 pre 开头添加顶部装饰条 span
            decorator_span = soup.new_tag('span', style=(
                'display: block; '
                'background: url(https://files.mdnice.com/user/3441/876cad08-0422-409d-bb5a-08afec5da8ee.svg); '
                'height: 30px; '
                'width: 100%; '
                'background-size: 40px; '
                'background-repeat: no-repeat; '
                'background-color: #282c34; '
                'margin-bottom: -7px; '
                'border-radius: 5px; '
                'background-position: 10px 10px;'
            ))
            pre.insert(0, decorator_span)
    
    # 4. 处理列表项
    for li in soup.find_all('li'):
        # 如果已经有 section，跳过
        if li.find('section'):
            continue
        
        # 获取列表项的所有内容（包括文本和标签）
        li_contents = list(li.contents)
        
        # 清空列表项
        li.clear()
        
        # 用 section 包裹内容
        section = soup.new_tag('section')
        # 将原始内容添加到 section 中
        for content in li_contents:
            section.append(content)
        
        li.append(section)
    
    # 5. 为其他元素添加 data-tool 属性
    for tag in soup.find_all(['p', 'ul', 'ol', 'blockquote']):
        tag['data-tool'] = 'mdnice编辑器'
    
    # 6. 修复 BeautifulSoup 的 class_ 问题，将 class_ 替换为 class
    result = str(soup)
    # 替换所有 class_= 为 class=
    result = result.replace('class_=', 'class=')
    # 替换所有 <br/> 为 <br>（与 target.html 保持一致）
    result = result.replace('<br/>', '<br>')
    
    return result

