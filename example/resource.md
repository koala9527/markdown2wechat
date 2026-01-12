# 🚀 手把手教你安装与测试 n8n：自动化工作流从此开始

> 自动化是现代工作流程的核心，而 n8n 作为一款开源的工作流自动化工具，正受到越来越多开发者和企业的青睐。本文将带你从零开始，完成 n8n 的安装与基础测试。

---

## 📋 目录
1. [什么是 n8n？](#什么是-n8n)
2. [安装前准备](#安装前准备)
3. [安装方法对比](#安装方法对比)
4. [详细安装步骤](#详细安装步骤)
5. [基础功能测试](#基础功能测试)
6. [常见问题解决](#常见问题解决)
7. [总结与建议](#总结与建议)

---

## 什么是 n8n？

**n8n** 是一个基于节点的开源工作流自动化工具，它允许你通过可视化界面连接不同的应用程序和服务。与 Zapier 或 IFTTT 类似，但 n8n 提供了更高的灵活性和控制权。

### ✨ 主要特点：
- ✅ **完全开源** - 可自行部署，无使用限制
- ✅ **自托管** - 数据完全掌握在自己手中
- ✅ **丰富的节点库** - 支持 200+ 应用和服务
- ✅ **可视化编辑器** - 拖拽式界面，易于使用

---

## 安装前准备

### 系统要求
| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Ubuntu 18.04+ / CentOS 7+ | Ubuntu 20.04+ |
| 内存 | 2 GB RAM | 4 GB RAM 或更高 |
| 存储 | 10 GB 可用空间 | 20 GB 或更高 |
| Node.js | 版本 14.x 或更高 | 版本 16.x |

### 📦 必要组件检查
```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version

# 检查 Docker（如果使用 Docker 安装）
docker --version
```

---

## 安装方法对比

### 方法选择指南
1. **Docker 安装** - 最简单快捷，适合大多数用户
2. **npm 安装** - 适合开发者，更灵活
3. **二进制包安装** - 适合生产环境

> 💡 **建议**：初次使用者推荐使用 Docker 安装，避免环境配置问题。

---

## 详细安装步骤

### 方法一：使用 Docker 安装（推荐）

#### 步骤 1：安装 Docker
```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker
```

#### 步骤 2：拉取 n8n Docker 镜像
```bash
# 拉取最新版 n8n 镜像
docker pull n8nio/n8n

# 查看已下载的镜像
docker images | grep n8n
```

#### 步骤 3：运行 n8n 容器
```bash
docker run -it --rm \n  --name n8n \n  -p 5678:5678 \n  -v ~/.n8n:/home/node/.n8n \n  n8nio/n8n
```

**参数说明：**
- `-p 5678:5678`：将容器端口映射到主机
- `-v ~/.n8n:/home/node/.n8n`：持久化数据存储
- `--name n8n`：容器名称

### 方法二：使用 npm 安装

#### 步骤 1：安装 Node.js 和 npm
```bash
# 使用 NodeSource 仓库安装 Node.js
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version  # 应显示 v16.x.x
npm --version   # 应显示 8.x.x
```

#### 步骤 2：安装 n8n
```bash
# 全局安装 n8n
sudo npm install n8n -g

# 或者使用 npx（无需安装）
npx n8n
```

#### 步骤 3：启动 n8n
```bash
# 直接启动
n8n start

# 使用自定义端口启动
n8n start --port=5678
```

---

## 基础功能测试

### 测试 1：访问 Web 界面
1. 打开浏览器，访问 `http://localhost:5678`
2. 你应该看到 n8n 的登录/注册页面
3. 首次使用需要创建管理员账户

### 测试 2：创建第一个工作流

#### 📝 示例：HTTP 请求测试工作流
1. **添加 HTTP Request 节点**
   - 从节点面板拖拽 "HTTP Request" 节点到画布
   - 配置 URL：`https://jsonplaceholder.typicode.com/posts/1`

2. **添加 Debug 节点**
   - 连接 HTTP Request 节点到 Debug 节点
   - 用于查看请求结果

3. **执行工作流**
   ```javascript
   // 预期返回的数据结构
   {
     "userId": 1,
     "id": 1,
     "title": "...",
     "body": "..."
   }
   ```

### 测试 3：触发器测试
1. **添加 Schedule 节点**
   - 配置为每分钟触发一次
2. **添加 Code 节点**
   ```javascript
   // 简单的 JavaScript 代码
   const now = new Date();
   return {
     timestamp: now.toISOString(),
     message: "定时任务执行成功！"
   };
   ```

### 📊 测试结果记录表
| 测试项目 | 预期结果 | 实际结果 | 状态 |
|----------|----------|----------|------|
| Web 界面访问 | 显示登录页面 | ✅ 正常显示 | 通过 |
| HTTP 请求 | 返回 JSON 数据 | ✅ 数据完整 | 通过 |
| 定时触发器 | 每分钟执行 | ✅ 按时执行 | 通过 |
| 数据持久化 | 重启后数据保留 | ✅ 数据完整 | 通过 |

---

## 常见问题解决

### ❗ 问题 1：端口被占用
```bash
# 查看占用 5678 端口的进程
sudo lsof -i :5678

# 终止占用进程
sudo kill -9 <PID>
```

### ❗ 问题 2：Docker 容器启动失败
```bash
# 查看容器日志
docker logs n8n

# 常见解决方案
# 1. 检查端口冲突
# 2. 检查卷挂载权限
# 3. 确保有足够内存
```

### ❗ 问题 3：npm 安装权限问题
```bash
# 使用 nvm 管理 Node.js 版本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新安装 Node.js
nvm install 16
nvm use 16
```

---

## 总结与建议

### ✅ 安装成功标志
1. 能够通过浏览器访问 n8n 界面
2. 可以创建和执行简单的工作流
3. 数据能够正确持久化保存

### 🎯 下一步建议
1. **探索更多节点**：尝试连接 Slack、Google Sheets 等常用服务
2. **学习表达式**：掌握 n8n 的表达式系统，实现更复杂的逻辑
3. **设置备份**：定期备份工作流配置
4. **安全配置**：设置 HTTPS、防火墙规则等安全措施

### 📚 学习资源
- [官方文档](https://docs.n8n.io)
- [社区论坛](https://community.n8n.io)
- [GitHub 仓库](https://github.com/n8n-io/n8n)

---

> 💎 **提示**：n8n 的强大之处在于其灵活性和可扩展性。从简单的工作流开始，逐步构建复杂的自动化流程，你会发现它能够显著提升工作效率。

---

**最后更新**：2024年  
**适用版本**：n8n 0.200+  
**测试环境**：Ubuntu 22.04, Docker 20.10, Node.js 16.x

希望这篇指南能帮助你顺利安装和测试 n8n！如果在安装过程中遇到任何问题，欢迎查阅官方文档或社区论坛获取帮助。🚀