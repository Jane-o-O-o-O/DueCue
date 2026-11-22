# 知期 DueCue 开发与部署

## 本地开发

使用 Node.js 22.13 或更高版本。推荐使用 Node.js 24，以便运行 VPS 适配层和支付本地沙箱。

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

从部署目录运行以下命令可签发 10 个一次性永久兑换码。SQLite 记录兑换码的 SHA-256 摘要，发码时需妥善保管命令输出的明文。

```sh
docker compose exec -T app node redemption.mjs issue permanent 10
```

## 截图解析

浏览器准备截图后将其上传给服务端。Responses API 配置使用 `gpt-6.2-sol`、`detail: high` 和 `store: false`。服务端优先读取 `SCREENSHOT_OPENAI_API_KEY`，也接受 `OPENAI_API_KEY`。通过 `SCREENSHOT_OPENAI_BASE_URL` 可指定兼容 Responses API 的 HTTPS 地址。截图缺少完整日期时，核对页留空，由用户核对后再保存字段。旧客户端发送的 OCR 文本由兼容入口处理。

## 支付配置

本地沙箱需要 Node.js 24、已配置的 `.alipay-sandbox.json` 和一次 `npm run build`。运行 `npm run alipay:sandbox`，打开 `http://127.0.0.1:5190`，从「设置 → 账号与权益 → 支付宝支付」进入测试收银台。沙箱使用独立数据库，测试套餐为 0.01 元、1 天，可用 `DUECUE_SANDBOX_PORT` 修改端口。

生产配置使用 `ALIPAY_MODE=production`、`PLAN_PRICE_CNY`、`PLAN_DAYS`、`ALIPAY_APP_ID`、`ALIPAY_SELLER_ID`、`ALIPAY_PRIVATE_KEY`（原始 PKCS#1 字符串）和 `ALIPAY_PUBLIC_KEY`。商户开通 AI 网页应用收款后，使用同一生产应用的参数联调。配置异步通知时，将 `ALIPAY_NOTIFY_URL` 设为公网可访问的 `/api/alipay/notify` 完整地址。未配置通知时，服务端会定时查单，验签并核对订单后发放时长。Cloudflare 部署每分钟查单，VPS 服务启动后自动补查。

商户后端可配置至少 32 字符的 `ALIPAY_MANAGEMENT_TOKEN`，以 Bearer 令牌调用 `POST /api/alipay/manage`。JSON 包含 `action` 和 `orderId`，支持 `query`、`close`、`refund` 和 `refundQuery`。退款和退款查询需要 `requestId`，发起退款时还需提供字符串金额 `amount`（元）。同一笔退款重试时使用相同的请求号和金额。退款后的已发权益按商户业务规则处理。

使用 iPhone 真机验证日历导入和提醒权限。使用沙箱验证收银台跳转和支付回写。接入参数和支付测试见 [支付宝接入笔记](alipay/README.md)。
