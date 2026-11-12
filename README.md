# 有期 · iPhone 订阅卡包

首版是手机网页应用，可从 Safari 添加到主屏幕。平台卡包、订阅日历、编辑、试用和账号数据均可使用。首次保存个人记录或成功使用 AI 后开始七天试用，示例卡片与个人记录分开。提醒通过用户导入 iPhone 日历生效。

## 开发

使用 Node.js 22.13 或更高版本。依次执行 `npm run install:ci` 和 `npm run build`。首次本地运行时，将 `drizzle/` 中的 SQL 按顺序应用到本地 D1 绑定 DB，再执行 `npm run dev`。

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_curly_lilith.sql
```

部署使用 Vinext、Cloudflare Workers 及 D1。生产账号取自托管平台提供的已验证用户标识，本地开发使用独立预览身份。在其他平台部署时需提供等价的身份验证，并确保服务端独占该标识。

## 模型与商户配置

服务端配置新生成的 `OPENAI_API_KEY`。已配置密钥时，云端识别使用 Responses API 的 `gpt-6.2-sol`，请求设置 `store: false`。未配置密钥时，图片由浏览器同源加载的 Tesseract LSTM 中英文模型读取，字段在本机提取和核对。首次本机识别成功后仅向服务端登记试用，保存时才提交用户确认的记录，业务数据库保存核对后的字段与证据文字。截图日期缺失时不会用上传日换算倒计时。

支付宝购买入口需同时配置 `PLAN_PRICE_CNY`、`PLAN_DAYS`、`ALIPAY_APP_ID`、`ALIPAY_SELLER_ID`、`ALIPAY_PRIVATE_KEY`（PKCS#8）、`ALIPAY_PUBLIC_KEY` 和 `ALIPAY_NOTIFY_URL`。商品为主动购买的固定时长权益，价格和时长由商户确定。收款方须开通对应手机网站支付产品，并确保支付宝能访问公开 HTTPS 异步通知地址 `/api/alipay/notify`。当前私有预览用于开发，开放购买前需用商户配置完成端到端支付、通知和订单核对。签名与通知均采用 RSA2，数据库按订单幂等发放权益。

使用 iPhone 真机时须验证日历导入、提醒权限和沙箱收银台跳转。已导入系统日历的事项由系统维护，后续修改或删除时需要同步处理系统日历中的事件。

赛事和支付开发资料见 [支付宝接入笔记](docs/alipay/README.md)。
