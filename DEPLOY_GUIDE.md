# 吹牛逼 V7.7 发布说明（GitHub + Cloudflare）

## 本版需要同步的文件

仓库：`https://github.com/KileMoran/chuiniubi`（主游戏仓库，**不是** `chuiniubi-relay`）。

1. `index.html` — V7.7 页面、开局人数、强制手动选宣称牌面的弹窗。
2. `server/game.js` — 发牌副数、单人自动进入下一轮、游戏状态。
3. `server/worker.js` — 允许 1–6 人创建房间、校验不同人数的牌总数、保留语音服务逻辑。
4. `tests/game.test.js` — 回归测试（建议更新）。
5. `README.md` — 游戏说明（建议更新）。
6. `CHANGELOG.md` — 新增 V7.7 更新日志（建议上传）。

`wrangler.toml` 和 `package.json` 没有改动，可以保留 GitHub 现有文件。

## 发布顺序

1. 先在本地保留现有仓库副本，或确认 GitHub Commit History 可用。
2. 将上面改动文件保持对应目录结构提交到 `KileMoran/chuiniubi` 的 `main` 分支。
3. 在 Cloudflare Workers & Pages > `my-chuiniubi-room` 查看 GitHub Builds 或 Deployments，确保最新 Worker 版本确实发布成功；若 Git 集成没自动部署，按照当前原 Worker 项目的既有部署流程触发一次部署。
4. 打开 `https://chuiniubi-relay.pages.dev/health` 或原 Worker `/health`。新版服务响应应包含 `"gameplay":"v7.7"`；原 `"version":"1.1-voice"` 字段保持不变。
5. 确认 GitHub Pages 主站已发布 V7.7，并在电脑/手机强制刷新。打开 `https://kilemoran.github.io/chuiniubi/` 查看创建房间下拉框是否出现 1–6 人。
6. 用**全新的六位房间号**测试单人、双人、三人、质疑后选择牌面、翻牌及断线重连。已进行中的旧房间最好等对局结束后再升级。

### 中国玩家入口

`https://chuiniubi-relay.pages.dev/` 和现有 `GAME` Service Binding 无需修改。中国玩家入口跳转到主站时会使用备用 WebSocket 地址。升级后仍能连同一个 Worker；需要让所有玩家刷新网页以获取新版前端。

### 注意

- 不要把主站 `index.html` 上传到 `chuiniubi-relay/public/index.html`：两者是不同网站。
- 不要删除或覆盖 Cloudflare RealtimeKit 环境变量和 `CF_RTK_API_TOKEN` 密钥。新版本 Worker 保留了原语音代码。
- 用户最初列出的 “1…A 2” 按标准扑克点数实现为 13 个牌面：3–10、J、Q、K、A（1）、2；不添加重复的数字 2。每次最多出 8 张牌的限制没有变化。
- 单人模式无对手质疑：每手牌结束后自动弃牌并开启新回合。
- 1–2 人：52 张；3 人：208 张；4–6 人：104 张；均没有大小王。
