# 吹牛逼 · V7.9 联机扑克牌游戏

> 本文档对应 2026-11-11 已上传的 V7.9 主站及 `server/game.js` 游戏规则。该项目为网页游戏，前端发布在 GitHub Pages，房间和规则运行在 Cloudflare Workers + Durable Objects；语音使用 Cloudflare RealtimeKit。

- 游戏主站：<https://kilemoran.github.io/chuiniubi/>
- 中国玩家备用入口：<https://chuiniubi-relay.pages.dev/>
- 本仓库：<https://github.com/KileMoran/chuiniubi>
- 备用入口代码：<https://github.com/KileMoran/chuiniubi-relay>

## 一、游戏规则（以服务端 `server/game.js` 为准）

| 人数 | 牌组 | 总张数 | 每副牌的大小王 |
|---|---|---:|---|
| 1 人 | 1 副 | 54 | 有（纯测试模式） |
| 2 人 | 1 副 | 54 | 有 |
| 3–6 人 | 2 副 | 108 | 有 |

- 创建房间时选择 1–6 人；必须人数凑齐、所有玩家在线，房主才能开始。
- 每局系统随机决定首手玩家。每一轮的第一手须自己选择要宣称的点数（3–10、J、Q、K、A、2）；之后跟牌只能沿用该点数，即使实际手牌不符合也可以撒谎。
- 每次可出 **1–12 张牌**，前端实时显示已选择张数，服务端再次核验。单人模式仅用于自行测试，没有随机彩蛋。
- 每副牌各有大王、小王，两者均为**万能癞子**：可以视作本轮宣称的点数，因此不算假牌；但同一手里的其他普通牌若与宣称点数不符，整手依然是撒谎。
- 玩家出牌后有约 **2 秒保护间隔**，防止下一位玩家立刻出牌。**两秒不是质疑截止时间**：其他玩家可以在刚出牌的冷却阶段及下一位玩家尚未完成出牌的阶段质疑上一手；无法质疑自己。
- 质疑成功：撒谎者收下桌上本轮全部牌，质疑者获得下一轮先手。质疑失败：质疑者收牌，真实出牌者获得下一轮先手。
- 质疑后先翻最后被质疑的那一手，再公开本轮其余牌，最后才执行收牌。无其他玩家继续出牌时，本轮暗牌弃置，由最近的出牌者先手。
- 一名玩家在合法完成最后一手牌且没有被成功抓假牌时获胜。正常玩家掉线后可通过原浏览器凭证重连恢复手牌。

## 二、V7.9 随机事件（彩蛋）

服务端每次成功出牌后，以 **3% 的总概率**尝试触发**一种**随机事件（不是每种事件各 3%）。单人模式不会触发。**每种事件每局最多发生一次，同一手最多发生一个事件。** 不符合条件的事件被抽中则本次不触发，且不占用次数。

| 事件 | 效果 |
|---|---|
| 郝老师突然走进宿舍 | 随机一名符合条件的玩家丢 1 张牌 |
| 垃圾桶被踩烂 | 随机一名符合条件的玩家丢 1 张牌 |
| 有牌意外翻开 | 将刚出的一手中的随机 1 张牌提前亮给所有人 |
| 手机收到重要消息 | 随机玩家在之后 4 个玩家行动回合内无法操作，轮到该玩家时由服务器跳过 |

前两种丢牌事件要求目标玩家至少有 **10 张手牌**；丢出的牌移入弃牌堆，游戏总张数保持守恒。第四种事件的倒计时按全体玩家接下来的行动推进，不等于被选中玩家自己的四次出牌机会。

## 三、项目文件结构

```text
index.html                    GitHub Pages 主页（内含 UI、游戏客户端、语音前端）
server/game.js                当前唯一使用的服务器游戏规则
server/worker.js              Cloudflare Worker、WebSocket、房间/语音 API
wrangler.toml                 Worker 和 Durable Objects 绑定配置
package.json                  本地开发/测试脚本
README.md                     本说明
CHANGELOG.md                  更新日志
DEPLOY_GUIDE.md               发布与部署说明
tests/game.test.js            常规游戏规则测试
tests/joker-rules.test.js     大小王和 12 张限制测试
tests/random-events.test.js   随机事件测试
tests/reveal-stages.test.js   双阶段揭牌和隐私测试
tests/room-lifecycle.test.js  房间重连/过期测试
preview/                      界面预览图片
```

旧根目录 `game.js` 不是 Worker 使用的模块，旧 `apply-upgrade.py`、`apply-upgrade.mjs`、`rules.json` 和 `UPLOAD_GUIDE.md` 是历史补丁工具/操作说明，不是当前运行游戏所需文件。请保留 Git 历史后再清理这些旧文件，避免误用。

## 四、跨国联机的工作方式

1. 英国玩家可直接从主游戏网站加入同一 6 位房间，默认 WebSocket 连接主 Worker：`wss://my-chuiniubi-room.syc050609.workers.dev`。
2. 中国玩家先打开 `https://chuiniubi-relay.pages.dev/`，输入房间号。备用大厅跳转到主站时会把 WebSocket 服务器参数设置为 `wss://chuiniubi-relay.pages.dev`。
3. `chuiniubi-relay` 的 Pages Functions 通过 **Service Binding `GAME`** 转发 `/ws` 和 `/health` 到同一个 `my-chuiniubi-room` Worker。它不另建房间，不复制牌局数据，也不存储玩家手牌。
4. 备用入口能打开不代表各网络都能稳定建立 WebSocket；语音也需要单独验证，因为 RealtimeKit 媒体连接不经游戏的 `/ws` 代理。

## 五、语音与配置安全

`server/worker.js` 的 RealtimeKit 语音接口仍使用下列 Cloudflare Worker 运行环境变量（此处只列名称，不包含具体值）：

- `CF_RTK_ACCOUNT_ID`
- `CF_RTK_APP_ID`
- `CF_RTK_API_TOKEN`（Secret）
- `CF_RTK_PRESET`

Worker 同时需要 Durable Objects 绑定 `ROOMS → GameRoom`。`wrangler.toml` 中保留 `keep_vars = true`，不要将 Token 写进 GitHub 文件或分享到聊天截图。

所有玩家离线持续 **2 小时**后，房间会由 Worker 的 Alarm 清除；有玩家持续在线则不会仅因不操作而到期。清理过的房间须重新创建。

## 六、更新与验证

详细上传/部署步骤见 [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)。**只更新本 README、CHANGELOG 或 `tests/`，不需要重新部署 Worker**。若改动 `server/game.js` 或 `server/worker.js`，必须确保 Cloudflare Worker 同步发布；若改动 `index.html`，必须确保 GitHub Pages 已发布并让玩家刷新。

- 服务器健康检查：<https://my-chuiniubi-room.syc050609.workers.dev/health>
- 备用健康检查：<https://chuiniubi-relay.pages.dev/health>

注意：Worker 的 `/health` 中 `version: 1.1-voice` 是语音/接口标识；如果 `gameplay` 字段仍显示 `v7.7.3`，这是旧的静态版本字符串，不代表当前牌组规则一定仍为 V7.7.3。确认实际规则要核对部署代码并新建房间测试。

## 七、当前维护说明

2026-11-11 的 V7.9 维护修复主要更新基础规则及大小王测试，使其与当前 54/108 张真实服务端一致，避免普通测试偶发触发随机彩蛋，并清理过期文档。**本维护不改变**线上游戏的出牌、质疑时间、随机事件概率、语音与联机协议。是否上线成功仍以生产环境具体部署和实际玩家连接验证为准。
