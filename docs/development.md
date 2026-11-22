# 知期 DueCue 开发与部署

## 本地开发

使用 Node.js 22.13 或更高版本。推荐使用 Node.js 24，以便运行 VPS 适配层。

```sh
npm run install:ci
npm run build

for migration in drizzle/*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
    d1 execute DB --local --config dist/server/wrangler.json \
    --persist-to .wrangler/state --file "$migration" || exit $?
done

npm run dev
```

首次启动时按文件名顺序应用 D1 迁移。打开开发命令输出的地址。Cloudflare 部署通过托管平台获取已验证的用户标识。本地预览使用独立身份。自托管时需要由可信服务端验证用户，并由服务端独占身份标识的注入。

## VPS 账户版

在仓库根目录安装锁定的依赖，并构建账户版。

```sh
npm ci
VITE_DUECUE_ACCOUNTS=1 npm run build
mkdir -p deploy/vps/dist
rsync -a dist/ deploy/vps/dist/
```

`deploy/vps` 包含 Docker Compose、SQLite 模式和账户服务。在自己的环境中配置域名、数据和模型目录，以及邮件、身份验证和识别服务的环境变量。SQLite 会在服务启动时执行迁移。

## 试用与永久兑换码

VPS 用户完成邮箱注册时创建试用记录，从注册时间起计 30 天。已有试用按原起算时间延长到 30 天，从未创建试用记录的老账号在升级时补齐。原有兑换时长及永久权益保留。Cloudflare 等外部身份服务的账号首次载入知期时开始试用。

用户可邮件申请永久使用。从部署目录运行以下命令可签发 10 个一次性永久兑换码。SQLite 记录兑换码的 SHA-256 摘要，发码时需妥善保管命令输出的明文。

```sh
docker compose exec -T app node redemption.mjs issue permanent 10
```

## 截图解析

浏览器准备截图后将其上传给服务端。Responses API 配置使用 `gpt-6.2-sol`、`detail: high` 和 `store: false`。服务端优先读取 `SCREENSHOT_OPENAI_API_KEY`，也接受 `OPENAI_API_KEY`。通过 `SCREENSHOT_OPENAI_BASE_URL` 可指定兼容 Responses API 的 HTTPS 地址。截图缺少完整日期时，核对页留空，由用户核对后再保存字段。旧客户端发送的 OCR 文本由兼容入口处理。
