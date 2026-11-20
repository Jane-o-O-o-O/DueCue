# 支付宝 AI 付 PAYATHON 2026 · 知期 DueCue 开发笔记

核对日期为 2026 年 11 月 19 日。主赛道选择 Vibe Pay。知期向用户交付有期限的订阅管理服务，收入来自用户购买知期使用权。用户录入的腾讯视频、话费或花呗金额只用于记账提醒。

## 赛事

| 项目 | 日期或金额 |
| --- | --- |
| 报名截止 | 2026 年 12 月 1 日 23:59:59 |
| 提交截止 | 2026 年 12 月 9 日 23:59:59 |
| 线下决赛 | 2026 年 12 月 26 日 |
| 总奖池 / Vibe Pay 一等奖 | 20 万元 / 3 万元 |

时间按项目给出的北京时间记录。个人或 2—5 人团队可参加。提交材料应能展示从导入、核对到到期提醒的完整体验，以及用户实际付费后可继续使用的权益。真实交易和反馈应在取得后记录。[赛事主页](https://aipay.alipay.com/community/events/payathon-2026)

## 文档与实现

| 官方资料 | 开发结论 |
| --- | --- |
| [Vibe Pay 产品介绍，本地原文](vibe-pay.md) | 知期采用基础收款模式，产品自行维护用户、订单和使用期限。 |
| [AI 网页应用收款指南，本地原文](web-payment-guide.md) | 同步跳回页面只用于恢复界面；权益以可信的异步通知或交易查询结果为准。重复通知只能产生一次权益变更。 |
| [网页应用下单接口](https://aipay.alipay.com/docs/vibe-pay/ai-web-app-payment-qianyi/api-list/alipay-trade-page-pay.md) | 知期网页与手机浏览器均使用 alipay.trade.page.pay，产品码为 FAST_INSTANT_TRADE_PAY。 |

知期已实现网页收银台、通知验签、主动查单和权益发放。正式站的配置位于 VPS 的 `/etc/duecue/app.env`。使用已开通 AI 网页应用收款的 AppID，配合同一应用的 RSA2 应用私钥与支付宝公钥。收款主体的 PID 填入 `ALIPAY_SELLER_ID`。价格和天数分别由 `PLAN_PRICE_CNY` 与 `PLAN_DAYS` 设置。VPS 实付测试时将 `ALIPAY_TEST_OWNER` 设为测试账号的用户标识，只向该账号开放购买；对外收款前清除该项。使用另一支付宝账号小额实付，确认到账状态和时长发放。

官方 Markdown 原文可在后续开发时刷新。[Vibe Pay 原文](https://aipay.alipay.com/docs/vibe-pay.md) · [网页接入指南原文](https://aipay.alipay.com/docs/vibe-pay/ai-web-app-payment-qianyi/ai-web-app-payment-integration-guide.md)
