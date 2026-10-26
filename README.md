# Tell·听耳 - 即时通讯平台

本优化版为 5.9.71，已加入局部更新、会话草稿保存、滑动标签切换、六组三色主题与圆形扩散动画。

本版修复 APK Not found，统一磨砂二级界面与弹窗，重排 PC 发现和设置页面；详见 [磨砂界面与APK修复说明.md](磨砂界面与APK修复说明.md)。

主题和安卓说明见 [主题与安卓更新说明.md](主题与安卓更新说明.md)。

- Docker 部署：参阅 [DOCKER部署说明.md](DOCKER部署说明.md)，在 Linux 服务器执行 `bash deploy/start.sh`。
- 默认前后台共用 `5555` 对外端口：前台 `/`、管理后台 `/admin`；容器内部 `3000`。
- 变更与验证：参阅 [优化分析与验证.md](优化分析与验证.md)。
- 当前服务实际使用 PostgreSQL 或本地 NeDB，以及 Socket.IO；下方原版技术说明保留供参考。

轻量级即时通讯 Web 应用，支持用户注册、好友管理、实时聊天等功能。

## 功能

- 用户注册与登录（密码加密存储）
- 好友搜索、添加与删除
- 一对一实时聊天（Supabase Realtime）
- 消息状态追踪（已发送/已读）
- 对话列表管理
- 管理后台面板
- PWA 支持（Service Worker 离线缓存与版本更新）
- 响应式设计

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML / CSS / JavaScript |
| 后端 | Node.js + Express |
| 数据库 | Supabase (PostgreSQL) |
| 实时通信 | Supabase Realtime (WebSocket) |
| 认证 | bcryptjs |
| 部署 | Vercel |

## 快速开始

1. 创建 Supabase 项目并获取 API Key
2. 设置环境变量 `SUPABASE_URL` 和 `SUPABASE_KEY`
3. 部署到 Vercel 或本地运行 `node index.js`

## 衍生项目

此仓库是 Tell 系列的核心模板，以下项目均基于此框架：
- [chat](https://github.com/ablcy/chat) - 聊天实例
- [hush](https://github.com/ablcy/hush) - 阅后即焚版本
- [link](https://github.com/ablcy/link) - 好友链接版
- [talk](https://github.com/ablcy/talk) - 对话交流版
