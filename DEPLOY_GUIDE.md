> **V7.7.2**：需同时更新 `index.html`、`server/game.js`、`server/worker.js`，并重新部署原 `my-chuiniubi-room` Worker；仅替换前端无法触发服务端分阶段揭牌。`GAME` Pages Binding 保持原状。

# 吹牛逼 V7.7.2 发布说明（GitHub + Cloudflare）

## 本版需要同步的文件

仓库：`https://github.com/KileMoran/chuiniubi`（主游戏仓库，**不是** `chuiniubi-relay`）。

1. `index.html` — V7.7.2 页面、居中选点、中央叠牌、双阶段翻牌画廊。
2. `server/game.js` — 发牌副数、单人模式、质疑后分两阶段公开牌面的服务器状态。
3. `server/worker.js` — 允许 1–6 人创建房间、校验不同人数的牌总数、保留语音服务逻辑。
4. `tests/game.test.js`、`tests/reveal-stages.test.js` 与 `tests/room-lifecycle.test.js` — 规则、翻牌隐私与房间生命周期测试（建议更新）。
5. `README.md` — 游戏说明（建议更新）。
6. `CHANGELOG.md` — 新增 V7.7.2 更新日志（建议上传）。

`wrangler.toml` 和 `package.json` 没有改动，请保留 GitHub 现有文件。**不要使用旧的 wrangler.toml 覆盖线上配置**，尤其不要丢失现有的 `keep_vars = true`，以免影响 RealtimeKit 环境变量或密钥。

## 发布顺序

1. 先在本地保留现有仓库副本，或确认 GitHub Commit History 可用。
2. 将上面改动文件保持对应目录结构提交到 `KileMoran/chuiniubi` 的 `main` 分支。
3. 在 Cloudflare Workers & Pages > `my-chuiniubi-room` 查看 GitHub Builds 或 Deployments，确保最新 Worker 版本确实发布成功；若 Git 集成没自动部署，按照当前原 Worker 项目的既有部署流程触发一次部署。
4. 打开 `https://chuiniubi-relay.pages.dev/health` 或原 Worker `/health`。新版服务响应应包含 `"gameplay":"v7.7.2"` 和 `"roomIdlePolicy":"2h-offline"`；原 `"version":"1.1-voice"` 字段保持不变。
5. 确认 GitHub Pages 主站已发布 V7.7.2，并在电脑/手机强制刷新。打开 `https://kilemoran.github.io/chuiniubi/` 查看创建房间下拉框是否出现 1–6 人。
6. 用**全新的六位房间号**测试单人、双人、三人、质疑后选择牌面、翻牌及断线重连。已进行中的旧房间最好等对局结束后再升级。

### 中国玩家入口

`https://chuiniubi-relay.pages.dev/` 和现有 `GAME` Service Binding 无需修改。中国玩家入口跳转到主站时会使用备用 WebSocket 地址。升级后仍能连同一个 Worker；需要让所有玩家刷新网页以获取新版前端。

### 注意

- 不要把主站 `index.html` 上传到 `chuiniubi-relay/public/index.html`：两者是不同网站。
- 不要删除或覆盖 Cloudflare RealtimeKit 环境变量和 `CF_RTK_API_TOKEN` 密钥。新版本 Worker 保留了原语音代码。
- 用户最初列出的 “1…A 2” 按标准扑克点数实现为 13 个牌面：3–10、J、Q、K、A（1）、2；不添加重复的数字 2。每次最多出 8 张牌的限制没有变化。
- 单人模式无对手质疑：每手牌结束后自动弃牌并开启新回合。
- 1–2 人：52 张；3 人：208 张；4–6 人：104 张；均没有大小王。


## V7.7.2 视觉与翻牌改动
- 手动选点菜单居中但不模糊游戏画面，手机横屏时放在左侧牌桌中心以完整露出右侧手牌。
- 全部玩家出牌叠放桌面中央，偏移和旋转为按卡牌编号确定的乱序位置。
- 质疑先展示最后一手和真假判定，随后才公开该轮之前全部牌面，并使用独立可滚动的全牌列表。
- 必须同时更新主站网页与原 Worker 才能实现双阶段翻牌。

## V7.7.1 房间自动清理
- 无玩家在线持续 2 小时，Durable Object Alarm 会删除房间持久化数据；同一个旧房间号不会被自动恢复。
- 旧前端即使尝试重连已经过期的房间，服务器返回 WebSocket 关闭码 4001；新前端会清除对应本地房间记录并回到主菜单。
- 配置保留现有 Worker 名称 `my-chuiniubi-room`、`ROOMS` 绑定、所有 RealtimeKit secrets 和中国 Pages `GAME` Service Binding。
- 已开局房间请尽量结束后再部署：旧版本长期无人在线的房间可能在首次访问时被清理。

### 期限说明
- `2 小时` 是**最后一名玩家掉线之后**计时，不是房间创建后 2 小时强制踢人。
- 如果你希望改成 30 分钟或其他时长，需要同步更新 `server/game.js` 与 `index.html` 中的 `ROOM_OFFLINE_TTL_MS`。
- 无法确认活跃时间的 V7.7 或更早版本旧房间，如果此刻没有在线玩家，将在第一次触发该 Durable Object 时清理；新版本创建的房间则会正常设置自动到期闹钟。
