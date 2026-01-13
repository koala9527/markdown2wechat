# Markdown 转微信公众号格式工具

一个基于 Next.js 的 Markdown 转微信公众号格式的转换工具。

![](static/image.png)

## ⚠️ 重要说明

**为了效果的稳定性，项目优先保证 Next.js 框架的 API 接口在微信公众号内的渲染效果，不保证网页预览的效果。**

- ✅ **默认主题**：使用「兰青」主题，所有调试和测试均以此主题为准
- ⚠️ **其他主题**：尚未完整测试，可能存在格式转换问题
- 🔧 **已知问题**：部分格式转换存在小问题，我们会积极处理

## 🚀 快速开始

### Vercel 一键部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=YOUR_REPO_URL)

1. 点击上方按钮，将项目克隆到你的 Vercel 账户
2. 进入 `next` 目录，Vercel 会自动识别 Next.js 项目
3. 部署完成后即可使用

### 本地开发

```bash
cd next
npm install
npm run dev
```

访问 `http://localhost:3000` 查看效果。

## 📁 项目结构

```
markdown2wechat/
├── next/                    # Next.js 主项目
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API 路由
│   │   │   ├── convert/    # Markdown 转换接口
│   │   │   └── themes/     # 主题列表接口
│   │   ├── page.tsx        # 前端页面
│   │   └── layout.tsx      # 布局组件
│   ├── lib/                # 工具函数
│   │   ├── mdnice-transform-new.ts  # HTML 格式转换
│   │   ├── mdnice-inline-styles.ts  # 样式内联
│   │   └── theme.ts        # 主题管理
│   └── theme/              # 主题配置文件目录
│       ├── 兰青.json       # 默认主题（已测试）
│       └── ...             # 其他主题（未完整测试）
└── spider/                 # 主题爬虫脚本
    └── spider.py           # 从 mdnice 拉取主题配置
```

## 🎨 主题管理

### 更新主题配置

项目支持从 mdnice 批量拉取所有公开主题。

#### 1. 配置授权信息

在项目根目录创建 `.env` 文件：

```env
MDNICE_AUTH=Bearer xxx.yyy.zzz
```

> 从浏览器开发者工具中复制 mdnice 网站的 Authorization 请求头

#### 2. 运行爬虫脚本

```bash
# 安装依赖
pip install requests python-dotenv

# 运行爬虫
python spider/spider.py
```

脚本会自动：
- 从 mdnice API 获取所有主题列表
- 下载每个主题的配置到 `next/theme/` 目录
- 生成 `主题名.json` 文件

#### 3. 使用主题

- **默认主题**：系统会自动使用「兰青」主题
- **切换主题**：通过 API 的 `theme` 参数指定主题名称
- **主题测试**：目前仅「兰青」主题经过完整测试，其他主题可能存在格式问题

## 🔌 API 接口

### POST /api/convert

转换 Markdown 为微信公众号格式 HTML。

**请求体：**
```json
{
  "markdown": "# 标题\n\n这是内容",
  "theme": "兰青"  // 可选，默认使用「兰青」主题
}
```

**响应：**
```json
{
  "success": true,
  "html": "<section id=\"nice\">...</section>",
  "style": "...",
  "customCss": "...",
  "theme": "兰青"
}
```

### GET /api/themes

获取所有可用主题列表。

**响应：**
```json
{
  "success": true,
  "themes": ["兰青", "山吹", "WeFormat", ...],
  "defaultTheme": "兰青"
}
```

## 🤖 n8n 工作流集成

### 开发背景

最近在折腾自动化内容产出，发现微信公众号的排版和发布流程非常割裂。虽然 [mdnice](https://www.mdnice.com/) 很好用，但它没有官方 API，很难集成到自动化流程里。

因此，本项目应运而生：通过提供标准的 REST API，可以轻松集成到 n8n 等自动化工作流平台，实现 Markdown 到微信公众号格式的自动化转换。

### 工作流模板

如需获取 n8n 工作流模板配置，请关注 **《AIGC挖掘机》** 公众号获取最新模板。

### 工作流效果示例


![](static/n8n.png)



## ⚙️ 技术栈

- **框架**: Next.js 14
- **Markdown 解析**: markdown-it
- **语法高亮**: highlight.js
- **HTML 处理**: cheerio
- **部署平台**: Vercel

## 📝 使用说明

1. 在左侧编辑器中输入 Markdown 内容
2. 右侧会显示转换后的效果
3. 右上角可以切换主题
4. 点击「一键复制HTML」复制转换后的 HTML
5. 将 HTML 粘贴到微信公众号后台进行发布

## ⚠️ 注意事项

1. **主题选择**：目前仅「兰青」主题经过完整测试，其他主题可能存在格式问题
2. **预览效果**：网页预览效果仅供参考，实际效果以微信公众号内为准
3. **格式问题**：部分复杂格式可能存在转换问题，我们会持续优化
4. **API 稳定性**：优先保证 API 接口的稳定性，网页预览功能可能不稳定

## 🔧 开发说明

### 本地开发环境

```bash
cd next
npm install
npm run dev
```

### 构建生产版本

```bash
cd next
npm run build
npm start
```

### 主题调试

- 所有主题配置文件位于 `next/theme/` 目录
- 默认主题为「兰青」，在 `next/lib/theme.ts` 中配置
- 修改主题后需要重启开发服务器

## 📄 许可证

MIT License

## 🙏 致谢

- 感谢 [mdnice](https://www.mdnice.com/) 提供的主题配置
- 感谢所有贡献者的支持

---

**提示**：如有问题或建议，欢迎提交 Issue 或 Pull Request。
