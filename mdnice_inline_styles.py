"""
将 CSS 样式内联到 HTML 元素上
"""
import re
from bs4 import BeautifulSoup
from typing import Dict, List, Tuple


def parse_css_rules(css_text: str) -> List[Tuple[str, str]]:
    """
    解析 CSS 文本，返回 (selector, styles) 元组列表
    处理压缩的 CSS（没有换行和多余空格）
    """
    rules = []
    
    # 移除注释
    css_text = re.sub(r'/\*.*?\*/', '', css_text, flags=re.DOTALL)
    
    # 移除 @media 等规则（暂时跳过）
    css_text = re.sub(r'@[^{]+\{[^}]*\{[^}]*\}[^}]*\}', '', css_text)
    
    # 匹配 CSS 规则：选择器 { 样式 }
    # 使用更精确的匹配，处理嵌套大括号
    i = 0
    while i < len(css_text):
        # 找到选择器开始（跳过空白）
        if css_text[i].isspace():
            i += 1
            continue
        
        # 找到第一个 {
        brace_start = css_text.find('{', i)
        if brace_start == -1:
            break
        
        selector = css_text[i:brace_start].strip()
        
        # 找到匹配的 }
        brace_count = 1
        brace_end = brace_start + 1
        while brace_end < len(css_text) and brace_count > 0:
            if css_text[brace_end] == '{':
                brace_count += 1
            elif css_text[brace_end] == '}':
                brace_count -= 1
            brace_end += 1
        
        if brace_count == 0:
            styles = css_text[brace_start + 1:brace_end - 1].strip()
            
            # 处理逗号分隔的多个选择器
            selectors = [s.strip() for s in selector.split(',')]
            for sel in selectors:
                if sel and styles:
                    # 清理选择器
                    sel = re.sub(r'\s+', ' ', sel)
                    rules.append((sel, styles))
        
        i = brace_end
    
    return rules


def selector_matches_element(selector: str, element, parent_context=None) -> bool:
    """
    检查 CSS 选择器是否匹配元素
    支持基本选择器：tag, .class, #id, tag.class, tag#id, 后代选择器, 子选择器
    """
    if not selector or not element or not element.name:
        return False
    
    # 移除伪类和伪元素
    selector = re.sub(r':[a-z-]+(\([^)]*\))?', '', selector)
    selector = re.sub(r'::[a-z-]+', '', selector)
    
    # 处理后代选择器和子选择器（简化：只检查最后一个部分）
    if ' ' in selector or '>' in selector:
        parts = re.split(r'[\s>]+', selector)
        selector = parts[-1] if parts else selector
    
    # 处理组合选择器（如 h1.content, #nice h1, .content 等）
    # 提取标签、class 和 id
    tag_match = re.match(r'^([a-z0-9]+)', selector)
    tag_name = tag_match.group(1) if tag_match else None
    
    classes = re.findall(r'\.([a-z0-9_-]+)', selector)
    ids = re.findall(r'#([a-z0-9_-]+)', selector)
    
    # 检查标签
    if tag_name and element.name != tag_name:
        return False
    
    # 检查 class
    if classes:
        element_classes = element.get('class', [])
        if isinstance(element_classes, str):
            element_classes = element_classes.split()
        for cls in classes:
            if cls not in element_classes:
                return False
    
    # 检查 id
    if ids:
        element_id = element.get('id', '')
        if element_id not in ids:
            return False
    
    # 如果没有指定标签、class 或 id，则匹配所有元素（不应该发生）
    if not tag_name and not classes and not ids:
        return False
    
    return True


def merge_styles(existing: str, new: str) -> str:
    """
    合并两个 style 字符串
    """
    if not existing:
        return new
    if not new:
        return existing
    
    # 解析现有样式
    existing_dict = {}
    for prop in existing.split(';'):
        prop = prop.strip()
        if ':' in prop:
            key, value = prop.split(':', 1)
            existing_dict[key.strip()] = value.strip()
    
    # 解析新样式
    for prop in new.split(';'):
        prop = prop.strip()
        if ':' in prop:
            key, value = prop.split(':', 1)
            existing_dict[key.strip()] = value.strip()
    
    # 重新组合
    return '; '.join(f'{k}: {v}' for k, v in existing_dict.items() if k and v)


def apply_inline_styles(html_content: str, css_text: str) -> str:
    """
    将 CSS 样式内联到 HTML 元素上
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 解析 CSS 规则
    css_rules = parse_css_rules(css_text)
    
    # 按选择器优先级排序（更精确的优先级计算）
    def selector_priority(selector: str) -> int:
        priority = 0
        # ID 选择器权重最高
        priority += selector.count('#') * 100
        # Class 选择器
        priority += selector.count('.') * 10
        # 标签选择器
        if re.match(r'^[a-z0-9]+', selector):
            priority += 1
        # 后代选择器增加复杂度
        if ' ' in selector or '>' in selector:
            priority += 5
        return priority
    
    # 按优先级排序：先按优先级从低到高，相同优先级时保持原有顺序
    # 这样高优先级的规则会覆盖低优先级的规则
    # 为每个规则添加原始索引，以便在相同优先级时保持顺序
    indexed_rules = [(i, selector, styles) for i, (selector, styles) in enumerate(css_rules)]
    indexed_rules.sort(key=lambda x: (selector_priority(x[1]), x[0]))
    css_rules = [(selector, styles) for _, selector, styles in indexed_rules]
    
    # 应用样式到元素
    for selector, styles in css_rules:
        # 清理选择器
        selector = selector.strip()
        if not selector:
            continue
        
        # 跳过伪类和伪元素选择器（::before, ::after, :hover 等）
        # 这些样式不应该应用到元素本身
        if '::' in selector or re.search(r':[a-z-]+(\([^)]*\))?', selector):
            # 检查是否是 ::before 或 ::after（这些不应该应用到元素）
            if '::before' in selector or '::after' in selector:
                continue
            # 其他伪类也跳过（如 :hover, :focus 等）
            if re.search(r':(hover|focus|active|visited|link)', selector):
                continue
        
        # 处理后代选择器和子选择器
        if ' ' in selector or '>' in selector:
            parts = re.split(r'[\s>]+', selector)
            # 处理 #nice pre.custom 这种情况
            if len(parts) > 1:
                # 检查第一部分是否是 #nice
                if parts[0] == '#nice':
                    # 在 #nice 内部查找匹配的元素
                    nice_section = soup.find('section', id='nice')
                    if nice_section:
                        final_selector = ' '.join(parts[1:]) if len(parts) > 1 else parts[-1]
                        # 在 nice_section 内部查找
                        if final_selector.startswith('.'):
                            class_val = final_selector[1:].split(':')[0]
                            for element in nice_section.find_all(class_=lambda x: x and class_val in (x if isinstance(x, list) else x.split())):
                                if selector_matches_element(final_selector, element):
                                    existing_style = element.get('style', '')
                                    element['style'] = merge_styles(existing_style, styles)
                        elif final_selector.startswith('#'):
                            id_val = final_selector[1:].split('.')[0].split(':')[0]
                            element = nice_section.find(id=id_val)
                            if element and selector_matches_element(final_selector, element):
                                existing_style = element.get('style', '')
                                element['style'] = merge_styles(existing_style, styles)
                        else:
                            # 标签选择器或组合选择器（如 pre.custom, h1 .content）
                            # 处理后代选择器（如 h1 .content）
                            if ' ' in final_selector:
                                # 这是后代选择器，需要在父元素内查找
                                parts = final_selector.split()
                                parent_tag = parts[0]
                                child_selector = ' '.join(parts[1:])
                                
                                # 在 nice_section 内查找父元素
                                for parent in nice_section.find_all(parent_tag):
                                    # 在父元素内查找子元素
                                    if child_selector.startswith('.'):
                                        class_val = child_selector[1:].split(':')[0]
                                        for child in parent.find_all(class_=lambda x: x and class_val in (x if isinstance(x, list) else x.split())):
                                            if selector_matches_element(child_selector, child):
                                                existing_style = child.get('style', '')
                                                child['style'] = merge_styles(existing_style, styles)
                                    else:
                                        # 其他情况
                                        for child in parent.find_all(True):
                                            if selector_matches_element(child_selector, child):
                                                existing_style = child.get('style', '')
                                                child['style'] = merge_styles(existing_style, styles)
                            else:
                                # 单个选择器
                                tag_match = re.match(r'^([a-z0-9]+)', final_selector)
                                tag_name = tag_match.group(1) if tag_match else None
                                
                                if tag_name:
                                    # 查找所有匹配的元素
                                    for element in nice_section.find_all(tag_name):
                                        if selector_matches_element(final_selector, element):
                                            existing_style = element.get('style', '')
                                            element['style'] = merge_styles(existing_style, styles)
                                else:
                                    # 没有标签，可能是纯 class（如 .custom）
                                    if final_selector.startswith('.'):
                                        class_val = final_selector[1:].split(':')[0]
                                        for element in nice_section.find_all(class_=lambda x: x and class_val in (x if isinstance(x, list) else x.split())):
                                            if selector_matches_element(final_selector, element):
                                                existing_style = element.get('style', '')
                                                element['style'] = merge_styles(existing_style, styles)
                    continue
                else:
                    # 其他后代选择器
                    final_selector = parts[-1] if parts else selector
                    parent_selector = ' '.join(parts[:-1]) if len(parts) > 1 else None
            else:
                final_selector = selector
                parent_selector = None
        else:
            final_selector = selector
            parent_selector = None
        
        # 特殊处理 #nice 选择器（单独的选择器，不是后代选择器）
        if final_selector == '#nice' and ' ' not in selector:
            nice_section = soup.find('section', id='nice')
            if nice_section:
                existing_style = nice_section.get('style', '')
                nice_section['style'] = merge_styles(existing_style, styles)
            continue
        
        # 查找所有可能匹配的元素
        candidates = []
        
        if final_selector.startswith('#'):
            # ID 选择器
            id_val = final_selector[1:].split('.')[0].split(':')[0]
            element = soup.find(id=id_val)
            if element and selector_matches_element(final_selector, element):
                candidates.append(element)
        elif final_selector.startswith('.'):
            # Class 选择器
            class_val = final_selector[1:].split(':')[0]
            for element in soup.find_all(class_=lambda x: x and class_val in (x if isinstance(x, list) else x.split())):
                if selector_matches_element(final_selector, element):
                    candidates.append(element)
        else:
            # 标签选择器或组合选择器
            tag_match = re.match(r'^([a-z0-9]+)', final_selector)
            tag_name = tag_match.group(1) if tag_match else None
            
            if tag_name:
                for element in soup.find_all(tag_name):
                    if selector_matches_element(final_selector, element):
                        candidates.append(element)
            else:
                # 没有标签，可能是纯 class 或 id（前面已处理）
                for element in soup.find_all(True):  # 所有元素
                    if selector_matches_element(final_selector, element):
                        candidates.append(element)
        
        # 如果有父选择器，过滤候选元素
        if parent_selector and candidates:
            filtered = []
            for candidate in candidates:
                # 检查父元素是否匹配
                parent = candidate.parent
                if parent and selector_matches_element(parent_selector, parent):
                    filtered.append(candidate)
            candidates = filtered
        
        # 应用样式到匹配的元素
        for element in candidates:
            existing_style = element.get('style', '')
            element['style'] = merge_styles(existing_style, styles)
    
    # 修复 BeautifulSoup 的 class_ 问题
    result = str(soup)
    result = result.replace('class_=', 'class=')
    # 替换所有 <br/> 为 <br>（与 target.html 保持一致）
    result = result.replace('<br/>', '<br>')
    
    return result

