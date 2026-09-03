# 自定义分支生产部署手册

这份手册用于维护 `custom` 分支，并把自定义镜像手动部署到生产 VPS。生产使用 Docker Compose；本地源码不会直接挂载到生产容器中。

## 固定路径和镜像

| 项目 | 值 |
| --- | --- |
| 本地源码 | `/Users/liwenxiang/Developer/web/new-api` |
| 自定义分支 | `custom` |
| Fork 仓库 | `https://github.com/liwenxiang-bot/new-api.git` |
| 上游仓库 | `https://github.com/QuantumNous/new-api.git` |
| Docker 镜像仓库 | `docker.io/liwenxiang0512/new-api` |
| VPS 生产目录 | `/opt/new-api` |
| 生产 Compose | `/opt/new-api/docker-compose.yml` |
| 部署脚本 | `/opt/new-api-deploy/deploy.sh` |
| 覆盖文件 | `/opt/new-api-deploy/compose.custom.yml` |

生产容器名是 `new-api`，端口是 `3000`。不要把本地旧的 `docker-compose.yml` 直接复制到 VPS，因为它可能引用官方镜像或包含不同的生产配置。

## 本地更新代码

前端测试和构建建议使用 Node.js 22，Docker 镜像目标为 `linux/amd64`。

```bash
cd /Users/liwenxiang/Developer/web/new-api

source /Users/liwenxiang/.nvm/nvm.sh
nvm use 22.22.1

git checkout custom
git status
```

修改代码后运行检查并提交：

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
git diff --check

git add .
git commit -m "描述本次修改"
git push origin custom
```

## 合并作者更新

不要直接覆盖自己的 `custom` 分支。先抓取上游，再合并：

```bash
cd /Users/liwenxiang/Developer/web/new-api
git fetch upstream
git checkout custom
git merge upstream/main
```

有冲突时，解决文件后执行：

```bash
git add 冲突文件
git commit
git push origin custom
```

合并后重新运行类型检查、测试和构建。

## 构建并推送镜像

每次部署都使用新的 Git 提交标签，不要重复使用 `latest`：

```bash
cd /Users/liwenxiang/Developer/web/new-api

TAG="custom-$(git rev-parse --short HEAD)"
IMAGE="docker.io/liwenxiang0512/new-api:$TAG"

echo "TAG=$TAG"
echo "IMAGE=$IMAGE"

docker buildx build \
  --builder claude-buildx \
  --platform linux/amd64 \
  --tag "$IMAGE" \
  --push .
```

如果本机没有 `claude-buildx`，执行 `docker buildx ls`，把 `--builder claude-buildx` 改成实际名称，或者删除该参数。

推送后检查镜像：

```bash
docker buildx imagetools inspect "$IMAGE"
```

记下输出的 `TAG`。本次页脚居中修复的标签是：

```text
custom-80d118387
```

## VPS 首次准备

以下命令只需要首次执行：

```bash
mkdir -p /opt/new-api-deploy

cat > /opt/new-api-deploy/compose.custom.yml <<'YAML'
services:
  new-api:
    image: docker.io/liwenxiang0512/new-api:custom-80d118387
YAML

chmod 600 /opt/new-api-deploy/compose.custom.yml
```

确认生产 Compose 项目名、工作目录和文件：

```bash
docker inspect new-api --format 'project={{ index .Config.Labels "com.docker.compose.project" }} dir={{ index .Config.Labels "com.docker.compose.project.working_dir" }} files={{ index .Config.Labels "com.docker.compose.project.config_files" }}'
```

如果 `files` 显示多个 Compose 文件，后续命令必须按原顺序带上全部 `-f` 参数。

## 使用部署脚本

确认脚本存在并检查语法：

```bash
chmod 700 /opt/new-api-deploy/deploy.sh
bash -n /opt/new-api-deploy/deploy.sh
```

以后每次生产部署只需把标签传给脚本：

```bash
/opt/new-api-deploy/deploy.sh custom-80d118387
```

脚本会自动完成：

1. 拉取新镜像；
2. 给旧镜像创建回滚标签；
3. 写入 `compose.custom.yml`；
4. 使用 `docker compose config --quiet` 检查合并配置；
5. 执行 `up -d --no-deps --force-recreate new-api`；
6. 检查 `/api/status`。

`config --quiet` 只检查配置，不会重启服务。真正切换生产的是 `up -d --no-deps --force-recreate new-api`。切换时会有短暂中断，但 Redis、`data` 和 `logs` 不会被删除或重建。

## 部署后检查

```bash
docker ps --filter name=^new-api$
docker inspect new-api --format 'image={{.Config.Image}} status={{.State.Status}}'
curl -fsS http://127.0.0.1:3000/api/status
docker logs --tail=100 new-api
cat /opt/new-api-deploy/last-rollback-tag
```

刚启动时偶尔出现 `curl: (56) Recv failure: Connection reset by peer`，通常是应用仍在初始化。脚本会重试约 60 秒，最后显示“部署成功”即可。

## 不使用脚本时的完整命令

先识别生产 Compose 项目：

```bash
PROD_DIR="$(docker inspect new-api --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}')"
PROD_PROJECT="$(docker inspect new-api --format '{{ index .Config.Labels "com.docker.compose.project" }}')"

echo "PROD_DIR=$PROD_DIR"
echo "PROD_PROJECT=$PROD_PROJECT"
```

保存旧镜像、拉取新镜像并写入覆盖文件：

```bash
TAG="custom-80d118387"
IMAGE="docker.io/liwenxiang0512/new-api:$TAG"

OLD_IMAGE_ID="$(docker inspect new-api --format '{{.Image}}')"
ROLLBACK_TAG="new-api-production:rollback-$(date +%Y%m%d%H%M%S)"
docker image tag "$OLD_IMAGE_ID" "$ROLLBACK_TAG"
echo "$ROLLBACK_TAG" | tee /opt/new-api-deploy/last-rollback-tag

docker pull "$IMAGE"

cat > /opt/new-api-deploy/compose.custom.yml <<EOF
services:
  new-api:
    image: $IMAGE
EOF
```

检查并切换：

```bash
docker compose \
  -p "$PROD_PROJECT" \
  -f "$PROD_DIR/docker-compose.yml" \
  -f /opt/new-api-deploy/compose.custom.yml \
  config --quiet

docker compose \
  -p "$PROD_PROJECT" \
  -f "$PROD_DIR/docker-compose.yml" \
  -f /opt/new-api-deploy/compose.custom.yml \
  up -d --no-deps --force-recreate new-api
```

## 回滚

查看旧镜像标签：

```bash
ROLLBACK_TAG="$(cat /opt/new-api-deploy/last-rollback-tag)"
echo "$ROLLBACK_TAG"
```

创建回滚覆盖文件：

```bash
cat > /opt/new-api-deploy/compose.rollback.yml <<EOF
services:
  new-api:
    image: $ROLLBACK_TAG
EOF
```

使用相同的生产 Compose 项目回滚：

```bash
PROD_DIR="$(docker inspect new-api --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}')"
PROD_PROJECT="$(docker inspect new-api --format '{{ index .Config.Labels "com.docker.compose.project" }}')"

docker compose \
  -p "$PROD_PROJECT" \
  -f "$PROD_DIR/docker-compose.yml" \
  -f /opt/new-api-deploy/compose.rollback.yml \
  up -d --no-deps --force-recreate new-api
```

回滚后重新检查：

```bash
curl -fsS http://127.0.0.1:3000/api/status
docker logs --tail=100 new-api
```

回滚镜像不会自动撤销数据库迁移。涉及表结构或数据迁移时，必须先做 RDS 快照，并确认迁移是否可逆。

## 镜像标签和摘要

标签便于识别提交版本：

```text
docker.io/liwenxiang0512/new-api:custom-80d118387
```

摘要会精确锁定镜像内容：

```text
docker.io/liwenxiang0512/new-api:custom-80d118387@sha256:...
```

当前流程使用基于 Git 提交的唯一标签，不重复使用旧标签。需要严格固定生产内容时，可以把覆盖文件中的 `image` 改成“标签 + 摘要”，每次更新时同时更新两者。

## 安全规则和故障处理

- 涉及数据库结构的更新，先在 staging 测试并做 RDS 快照。
- 不要执行 `docker compose down -v`，不要删除生产 `data`、`logs` 或数据库卷。
- 不要执行 `docker system prune -a`。
- 不要在生产服务器运行仓库自带的开发 Compose 文件。
- 不要把生产数据库连接字符串、密码或 `.env` 内容提交到 GitHub、聊天记录或本文档。
- `docker pull` 报 `manifest unknown` 时，先确认本地镜像已经使用同一个标签推送成功。
- 脚本提示无法识别 Compose 项目时，检查 `docker inspect new-api` 的标签输出，不要凭目录名猜项目名。
- `version is obsolete` 只是 Compose 警告，不影响运行。
