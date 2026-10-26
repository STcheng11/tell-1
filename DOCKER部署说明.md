# Tell 5.9.71 Docker 部署

目标访问地址：`http://124.222.203.14:5555`。前台、管理后台、API 和 Socket.IO 共用此端口；容器内部使用 3000。

## 启动

服务器需已有 Docker Engine 和 Docker Compose v2（支持 `up --wait`）。将压缩包上传并解压，在项目目录执行：

```bash
bash deploy/start.sh
```

脚本首次运行会从 `.env.example` 创建权限为 600 的 `.env`，使用约定的后台初始密码 `114514`，构建镜像并等待健康检查通过。它不会安装 Docker、改动防火墙或覆盖已有 `.env`。

- 前台：`http://124.222.203.14:5555`
- 后台：`http://124.222.203.14:5555/admin`
- 健康检查：`http://124.222.203.14:5555/api/health`
- 管理员初始密码：`114514`（`.env` 的 `ADMIN_PASSWORD`）。已有数据中的后台密码优先；在后台修改后的密码会保留。

在云服务器安全组及系统防火墙放行 TCP 5555。如修改 `.env` 中的 `APP_PORT`，访问地址和放行端口也需同步修改。不要直接复制 `.env.example` 中的占位密码启动。

已有数据如果仍使用以前的后台密码：将 `.env` 中的 `ADMIN_PASSWORD` 改为 `114514`，执行 `bash deploy/reset-admin-password.sh`。脚本会停止应用写入，将配置同步到数据库，再启动应用；不会清除账号或消息。

## 数据与升级

默认使用 NeDB，适合单实例运行，无需额外数据库容器。`tell-data` 和 `tell-uploads` 两个命名卷分别持久保存数据库和上传文件。重建或重启容器不会清除这些卷。

```bash
docker compose ps
docker compose logs --tail=100 app
docker compose restart app
```

更新源码前先备份：

```bash
bash deploy/backup.sh
docker compose up -d --build --wait --wait-timeout 180
```

备份脚本短暂暂停应用写入，复制数据、上传文件和 `.env` 到 `backups/时间戳/`，随后恢复应用。不要执行 `docker compose down -v`，该命令会删除数据卷。

已有 NeDB 数据迁移时，应先停止旧服务并备份，再将旧项目的 `data/` 和 `uploads/` 内容导入对应卷。不要让两个进程同时写同一份 NeDB 数据。

可填写 `DATABASE_URL` 使用已有 PostgreSQL。默认启用 TLS 和证书验证；内网无 TLS 的数据库需显式设置 `DATABASE_SSL=false`。本次实际验证使用 NeDB，未验证 PostgreSQL 迁移。

## HTTPS 与通话

通过公网 IP 的 HTTP 地址可访问聊天界面，但浏览器的摄像头、麦克风和 Service Worker 等功能要求安全上下文。要使用完整语音视频和 PWA，请配置域名及 HTTPS；反向代理示例在 `deploy/nginx.conf.example`，已包含 Socket.IO 的 WebSocket 转发。

跨复杂 NAT 的通话还需你自己的 TURN 服务。在 `.env` 填写 `TURN_URLS`（多个地址用逗号分隔）、`TURN_USERNAME`、`TURN_PASSWORD` 后重建应用。未填写时只使用 STUN。本版不再内置原作者的中继 IP 或共享凭据，也不默认启动旧版 Coturn 示例。

原包的 `docker-compose.local.yml` 和 `deploy-turn-server.sh` 等是旧 TURN 调试文件，不是聊天主服务部署入口。请使用本说明中的主 `docker-compose.yml`。

## 验证范围

- 实际 Node 服务已完成注册、加好友、私聊、建群、入群、群消息及重启后数据保留的测试。
- 前台、后台资源和权限检查已验证；未做完整安全审计，原有普通用户 API 的认证架构仍沿用项目设计。
- 本机没有 Docker Engine，尚未执行镜像构建或容器健康检查；此包不是已经部署到远程服务器的结果。
- 未测试真实设备间的摄像头、麦克风与 TURN 穿透。

参考：[Docker Compose 服务配置](https://docs.docker.com/reference/compose-file/services/)、[Docker 构建最佳实践](https://docs.docker.com/build/building/best-practices/)、[浏览器媒体安全上下文要求](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)。
