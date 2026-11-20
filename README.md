# 知期 DueCue · iPhone 订阅卡包

首版是手机网页应用，可从 Safari 添加到主屏幕。平台卡包、订阅日历、编辑、试用和账号数据均可使用。首次保存个人记录或成功使用 AI 后开始七天试用，示例卡片与个人记录分开。提醒通过用户导入 iPhone 日历生效。

## 开发

使用 Node.js 22.13 或更高版本。依次执行 `npm run install:ci` 和 `npm run build`。首次本地运行时，将 `drizzle/` 中的 SQL 按顺序应用到本地 D1 绑定 DB，再执行 `npm run dev`。

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_curly_lilith.sql
```

部署使用 Vinext、Cloudflare Workers 及 D1。生产账号取自托管平台提供的已验证用户标识，本地开发使用独立预览身份。在其他平台部署时需提供等价的身份验证，并确保服务端独占该标识。

## 模型与商户配置

截图经浏览器准备后上传给服务端，由 Responses API 的 `gpt-6.2-sol` 按 `detail: high` 读取，使用低推理强度，设置 `store: false`。服务端优先读取专用的 `SCREENSHOT_OPENAI_API_KEY`，也接受 `OPENAI_API_KEY`。自有中转可通过 `SCREENSHOT_OPENAI_BASE_URL` 配置为支持 Responses API 的 HTTPS 版本地址。截图缺少完整日期时，核对页留空。保存时账本记录用户核对后的字段。旧版客户端发送的 OCR 文本仍由兼容入口处理。

### 支付宝网页应用收款

本地沙箱需要 Node.js 24、已配置的 `.alipay-sandbox.json` 和一次 `npm run build`。运行 `npm run alipay:sandbox` 后，打开 `http://127.0.0.1:5190`，在「设置」中点击「支付宝购买」。沙箱使用独立的本地数据库，购买项为 0.01 元、1 天。可用 `DUECUE_SANDBOX_PORT` 指定本地端口。

生产配置使用 `ALIPAY_MODE=production`、`PLAN_PRICE_CNY`、`PLAN_DAYS`、`ALIPAY_APP_ID`、`ALIPAY_SELLER_ID`、`ALIPAY_PRIVATE_KEY`（原始 PKCS#1 字符串）和 `ALIPAY_PUBLIC_KEY`。商户需开通 AI 网页应用收款，并用同一生产应用的参数完成联调。使用通知时设置 `ALIPAY_NOTIFY_URL` 为公网可访问的 `/api/alipay/notify` 完整地址。无通知地址时由服务端定时查单，验签并核对订单后幂等发放使用时长。Cloudflare 使用一项每分钟运行的定时任务，VPS 进程启动后自动补查。D1 生产库按顺序应用 `drizzle/` 中的迁移，VPS SQLite 会在启动时执行升级。

商户后端可配置至少 32 字符的 `ALIPAY_MANAGEMENT_TOKEN`，以 Bearer 令牌调用 `POST /api/alipay/manage`。JSON 包含 `action` 和 `orderId`。操作支持 `query`、`close`、`refund`、`refundQuery`。退款和退款查询需要 `requestId`，发起时还需字符串金额 `amount`（元）。同一笔退款重试用相同请求号和金额。门店处理退款后按业务规则处理已发权益。

使用 iPhone 真机时须验证日历导入、提醒权限和沙箱收银台跳转。已导入系统日历的事项由系统维护，后续修改或删除时需要同步处理系统日历中的事件。

赛事和支付开发资料见 [支付宝接入笔记](docs/alipay/README.md)。

## 本地构建 VPS 版本

在仓库根目录安装锁定的依赖，然后构建账户版。

```sh
npm ci
VITE_DUECUE_ACCOUNTS=1 npm run build
mkdir -p deploy/vps/dist
rsync -a dist/ deploy/vps/dist/
```

`deploy/vps` 是独立运行适配层。其 Compose 文件引用宿主机的环境配置、SQLite 数据目录和模型文件。
在自有环境中使用时，请按你的域名和目录配置这些路径，并在宿主机提供邮件、账户和识别所需的环境变量。
该目录保留原有部署配置，便于对照，不会在构建时启动服务。

在正式站 Compose 目录运行 `docker compose exec -T app node redemption.mjs issue permanent 10` 可签发 10 个一次性永久兑换码。SQLite 保存兑换码的 SHA-256 摘要，命令输出的明文请妥善保存。

整理记录见 [开发历史重建说明](HISTORY.md)。
