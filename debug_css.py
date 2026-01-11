"""调试 CSS 解析"""
import json
import re
from pathlib import Path

# 读取主题配置
theme_path = Path("theme/兰青.json")
with theme_path.open("r", encoding="utf-8") as f:
    config = json.load(f)

css = config["data"]["style"]

# 查找 pre.custom 相关规则
print("查找 #nice pre.custom 规则:")
rules = re.findall(r'#nice\s+pre\.custom[^{]*\{[^}]+\}', css)
print(f"找到 {len(rules)} 条规则")
for i, rule in enumerate(rules[:3]):
    print(f"\n规则 {i+1}:")
    print(rule[:500])

# 查找 code.hljs 相关规则
print("\n\n查找 #nice code.hljs 规则:")
code_rules = re.findall(r'#nice[^{]*code[^{]*\{[^}]+\}', css)
print(f"找到 {len(code_rules)} 条规则")
for i, rule in enumerate(code_rules[:3]):
    print(f"\n规则 {i+1}:")
    print(rule[:500])

# 查找所有包含 border-radius 或 box-shadow 的规则
print("\n\n查找包含 border-radius 或 box-shadow 的规则:")
shadow_rules = re.findall(r'[^{]*\{[^}]*box-shadow[^}]+\}', css)
print(f"找到 {len(shadow_rules)} 条包含 box-shadow 的规则")
for i, rule in enumerate(shadow_rules[:3]):
    print(f"\n规则 {i+1}:")
    print(rule[:300])

