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
| [手机网站支付接口](https://opendocs.alipay.com/open/02ivbs) | 当前 iPhone Safari 版本使用 alipay.trade.wap.pay。网页指南示例使用 alipay.trade.page.pay，两者的签约产品和产品码应分别核对。 |

项目已经实现手机网站下单、通知验签和权益发放。开通收款前需确定时长及价格，确认商户已签约手机网站支付，在可公开访问的通知地址测试付款和重复回调。沙箱交易验证和丢失通知时的主动查单仍待完成。

官方 Markdown 原文可在后续开发时刷新。[Vibe Pay 原文](https://aipay.alipay.com/docs/vibe-pay.md) · [网页接入指南原文](https://aipay.alipay.com/docs/vibe-pay/ai-web-app-payment-qianyi/ai-web-app-payment-integration-guide.md)
