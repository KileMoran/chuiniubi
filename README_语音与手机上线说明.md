# 吹牛逼 V7.4 — 语音 + 手机横屏版

## 游戏已改动
- 手机竖屏：上方牌桌，下方操作和手牌；头像不越界，手牌可滚动。
- 手机横屏：左侧牌桌（58%），右侧操作台（42%），出牌/质疑/不出牌和手牌全在可操作区域。
- 语音：加入语音、退出语音、麦克风开关、静音扬声器、好友独立音量、头像说话提示。
- 不启用语音时仍保留原来的 Cloudflare 游戏房间、牌数和重连机制。
- 语音默认关闭；网页刷新后不会擅自重新开启麦克风。

## 第一部分：替换 GitHub 文件

打开 https://github.com/KileMoran/chuiniubi ，解压本包。GitHub 仓库需要更新：
1. `index.html` — 网页前端（手机布局 + 语音按钮）
2. `server/worker.js` — Cloudflare Worker（语音令牌处理）

其它文件 `server/game.js`、`wrangler.toml`、`package.json` 保持原状，包内同时带了一份供检查。GitHub 上传时必须保留 server 文件夹。

在 GitHub 的 `main` 分支提交更改后，GitHub Pages / Cloudflare Builds 会依各自原有自动部署配置更新。不要把 ZIP 直接上传到仓库指望 GitHub 自动解压。

检查 Cloudflare Worker 的版本：
https://my-chuiniubi-room.syc050609.workers.dev/health
新版本应该显示 `"version":"1.1-voice"`。如果仍然是 `1.0`，先检查 Cloudflare Deployments 是否成功部署本次提交。

## 第二部分：启用 Cloudflare RealtimeKit 语音

这一步必须在你的 Cloudflare 账户操作，我无法为你创建账户里的 RealtimeKit App，也不能获知你的密钥。

1. 登录 Cloudflare Dashboard，在左侧 `Realtime` 下进入 `RealtimeKit`，创建一个 App。
2. 在该 App 的 Presets 中新建一个名为 `voice_game` 的语音预设，类型务必选择 **Voice / Audio Room（纯音频）**，允许成员 **发送音频、接收音频**，不使用视频、录制、转写或等候室。
3. 创建一个 Cloudflare API Token，仅授予此集成所需的 `Realtime / Realtime Admin` 权限（尽量限制到当前账户）。**不要**把 Token 写在 HTML、GitHub、公开的 README、聊天或截图里。
4. 到 `Workers & Pages → my-chuiniubi-room → Settings → Variables and Secrets`，添加：

| 名称 | 值 | 类型 |
|---|---|---|
| `CF_RTK_ACCOUNT_ID` | Cloudflare 账户 ID | 文本/Secret 均可 |
| `CF_RTK_APP_ID` | RealtimeKit 应用 ID | 文本/Secret 均可 |
| `CF_RTK_PRESET` | `voice_game`（必须等于真实存在的预设名称） | 文本 |
| `CF_RTK_API_TOKEN` | 你刚创建的 Cloudflare Realtime API Token | **Secret**（不可公开） |

保存配置后，如果需要，重新部署 Worker。无需更换游戏的网址和房间号。

官方接入指南：
- https://developers.cloudflare.com/realtime/realtimekit/quickstart/
- https://developers.cloudflare.com/realtime/realtimekit/concepts/preset/
- https://developers.cloudflare.com/realtime/realtimekit/audio-calls/
- https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/add_participant/

## 第三部分：首次联机语音测试

1. 两个不同设备/浏览器加入同一游戏房间。
2. 点击“加入语音”（可以在等待大厅或游戏页面点击）。
3. 加入成功后麦克风默认关闭，玩家自行点击“开启麦克风”，允许浏览器使用麦克风。
4. 一方说话，另一方应该能听见；若 Safari 拦截自动音频播放，可点“点击播放声音”。
5. 点击“好友音量设置”可单独调整其他用户的音量，点击“退出语音”仅停止语音，不退出游戏。
6. 用手机旋转横屏，布局自动切换为左牌桌、右控制区。手机浏览器不保证可以通过网页强制锁定方向，请手动关闭设备的竖屏锁定。

## 注意事项与测试范围
- 我已做 HTML/JS 语法检查、6 项原有游戏规则测试、模拟 Worker 发令牌与缓存测试、假 SDK 按钮/静音行为测试和几种手机尺寸的无报错渲染测试。
- **还未**使用你的真实 RealtimeKit App、实际 API Token、两台真实设备验证通话。部署配置完成后才可以做线上验证。
- 如果未配置四项变量，游戏仍可正常进行；点击语音按钮时只会显示语音不可用提示。
- 单台设备多个页面重复登录可能使旧页面的身份连接失效；建议每名玩家独立浏览器与设备测试。
- RealtimeKit 使用独立媒体流，音频不通过现有游戏 WebSocket 传输。
