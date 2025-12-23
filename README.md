# Markdown转公众号格式工具

这是一个基于FastAPI的Markdown转微信公众号格式的转换工具，支持实时预览和多主题配置（自动拉取 mdnice 主题）。

## 功能特点

- ✅ 实时预览：左侧编辑Markdown，右侧实时显示转换效果
- ✅ 主题配置：使用theme文件夹的主题配置文件自定义样式
- ✅ 响应式设计：支持拖拽调整左右面板大小
- ✅ 防抖优化：输入防抖，减少不必要的API调用

## 安装依赖

### 使用 uv（推荐）

[uv](https://github.com/astral-sh/uv) 是一个极快的 Python 包管理器和项目管理工具。

#### 安装 uv

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**macOS/Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

#### 使用 uv 安装依赖

```bash
# 方式1：使用pyproject.toml（推荐）
uv sync

# 方式2：使用requirements.txt
uv pip install -r requirements.txt

# 方式3：创建虚拟环境后安装
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -r requirements.txt
```

#### 使用 uv 运行项目

```bash
# 直接运行（uv会自动管理虚拟环境）
uv run python main.py

# 或者使用uvicorn
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 使用 pip（传统方式）

```bash
pip install -r requirements.txt
```

## 运行项目

### 使用 uv

```bash
uv run python main.py
```

或使用uvicorn：

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 使用传统方式

```bash
python main.py
```

或使用uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 访问地址

启动后访问：http://localhost:8000

## 项目结构

```
markdown2wechat/
├── 1.json              # 主题配置文件
├── main.py             # FastAPI主程序
├── pyproject.toml      # 项目配置（uv使用）
├── requirements.txt    # Python依赖（pip使用）
├── Dockerfile          # Docker镜像构建文件
├── docker-compose.yml  # Docker Compose配置
├── docker-start.bat    # Windows Docker启动脚本
├── docker-start.sh     # Linux/macOS Docker启动脚本
├── run.bat             # Windows本地运行脚本
├── theme/              # 通过爬虫脚本抓取到的 mdnice 主题（每个主题一个 json）
├── spider/             # 主题爬虫脚本目录
│   ├── spider.py       # 从 mdnice 拉取所有主题的脚本
│   └── readme.md       # 简要说明
├── templates/          # HTML模板目录
│   └── index.html     # 前端页面
└── static/            # 静态文件目录
```

## API接口

### POST /api/convert
转换Markdown为公众号格式HTML（支持按主题名称切换样式）。

**请求体：**
```json
{
  "markdown": "# 标题\n\n这是内容",
  "theme": "山吹"    // 可选，主题名称，不传则使用默认主题
}
```

**响应：**
```json
{
  "success": true,
  "html": "<div id=\"nice\">...</div><style>...</style>",
  "style": "...",       // 主题的 style 字段
  "customCss": "...",   // 主题的自定义 CSS（customStyle.customCss）
  "theme": "山吹"       // 实际使用的主题名称
}
```

### GET /api/theme
获取某个主题的完整配置（不传 theme 参数时返回默认主题）。

### GET /api/themes
列出所有可用主题名称和默认主题。

## 使用说明

1. 在左侧编辑器中输入Markdown内容
2. 右侧会自动显示转换后的公众号格式效果
3. 右上角下拉框可以切换不同主题（来自 mdnice 抓取的主题）
4. 可以拖拽中间的分隔线调整左右面板大小
5. 所有样式都基于 `theme/` 目录下的主题配置文件（爬虫脚本生成）
6. 右上角「一键复制HTML」可以直接复制当前预览 HTML，粘贴到公众号后台

## 主题更新与管理

本项目支持从 mdnice 批量拉取所有公开主题，并在前端下拉框中切换预览。

### 1. 配置授权信息（.env）

在项目根目录创建 `.env` 文件，内容类似：

```env
MDNICE_AUTH=Bearer xxx.yyy.zzz      # 必填，从浏览器复制 mdnice 的 Authorization 头
```

> `.env` 已加入 `.gitignore`，不会被提交到仓库。

### 2. 运行爬虫脚本抓取主题

在项目根目录执行：

```bash
# 使用 uv（推荐）
uv run python spider/spider.py

# 或使用系统 Python
python spider/spider.py
```

脚本行为：

- 调用 `https://api.mdnice.com/themes?pageSize=100&currentPage=1` 获取所有主题列表
- 对每个主题调用 `https://api.mdnice.com/articles/styles` 获取样式配置
- 将返回结果保存到 `theme/主题名.json`（文件名是主题的 name，已做文件名合法化）
- 对于返回 `文章不存在` 等错误的主题会打印警告并跳过，不影响其它主题抓取

抓取完成后，你会在 `theme/` 目录下看到多个以主题名命名的 json 文件，例如：

```text
theme/
├── 山吹.json
├── WeFormat.json
├── ...
```

### 3. 后端如何使用这些主题

`main.py` 会从 `theme/` 目录中自动读取主题：

- **默认主题**：`theme/` 中排序后的第一个文件（去掉 `.json` 后缀的名字）
- `/api/themes`：返回所有主题名称和默认主题名
- `/api/theme?theme=山吹`：返回指定主题的完整配置 JSON
- `/api/convert`：请求体中可选字段 `theme` 指定主题；不传时使用默认主题

例如：

```json
POST /api/convert
{
  "markdown": "# 标题\\n\\n这是内容",
  "theme": "山吹"
}
```

后端会读取 `theme/山吹.json` 生成样式，并在响应中返回带样式的 HTML。

### 4. 前端如何使用这些主题

- 页面加载时，前端会调用 `GET /api/themes` 加载所有主题，并填充右上角的下拉框
- 默认选中接口返回的 `defaultTheme`
- 每次你切换下拉框中的主题名，前端都会携带对应的 `theme` 字段重新调用 `/api/convert`
- 预览区域实时展示不同主题下的公众号排版效果

## Docker 部署

### 使用 Docker Compose（推荐）

**快速启动：**
- Windows: 双击运行 `docker-start.bat`
- Linux/macOS: 运行 `bash docker-start.sh`

**手动启动：**
```bash
# 构建并启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build
```

### 使用 Docker

```bash
# 构建镜像
docker build -t markdown2wechat .

# 运行容器
docker run -d -p 8000:8000 --name markdown2wechat markdown2wechat
```

访问地址：http://localhost:8000

## 技术栈

- **后端**: FastAPI
- **前端**: 原生HTML/CSS/JavaScript
- **Markdown解析**: python-markdown
- **主题配置**: JSON格式的CSS样式配置
- **包管理**: uv（推荐）或 pip
- **容器化**: Docker + Docker Compose

