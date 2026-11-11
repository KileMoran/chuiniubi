# 吹牛逼 V7.9 · GitHub 更新与 Cloudflare 发布说明

## 先确认：本次维护需要部署什么？

**只更新测试与文档时，Cloudflare Worker 不需要重新部署。** 本次替换的 `README.md`、`CHANGELOG.md`、`DEPLOY_GUIDE.md` 与 `tests/game.test.js`、`tests/joker-rules.test.js`、`tests/reveal-stages.test.js` 不会改变实际游戏逻辑，也不需要在 GitHub 里运行 npm。

| 变更的文件 | 需要的操作 |
|---|---|
| `README.md`、`CHANGELOG.md`、`DEPLOY_GUIDE.md`、`tests/` | 上传提交 GitHub 即可；无须更新 Worker |
| `index.html` | GitHub Pages 自动发布后刷新网页 |
| `server/game.js` 或 `server/worker.js` | 上传 GitHub **并确认原 Worker 已重新部署**；否则线上服务器仍会运行旧代码 |
| `chuiniubi-relay` 仓库内的 `functions/` 或 `public/` | 需该独立 Pages 项目重新发布 |

## 一、最简单的网页上传方法

1. 打开主仓库 <https://github.com/KileMoran/chuiniubi>，确认当前分支为 `main`。
2. 下载 ChatGPT 提供的 ZIP 并解压；在 GitHub 仓库页面选择 **Add file → Upload files**（如果看不到，留意右侧 `+` 菜单）。
3. **把解压后的文件和 `tests` 文件夹内容保留原目录结构上传**。不要多套一层 `UPLOAD_TO_GITHUB/` 目录。确认目的路径应为 `tests/game.test.js` 和 `tests/joker-rules.test.js`，而不是仓库根目录的两个测试文件。
4. 覆盖同名旧文件，提交说明可填 `Fix V7.9 tests and update documentation`，点击 **Commit changes**。
5. 检查提交后的文件路径和 README 首页内容已经改变。若 GitHub Pages 因提交触发构建，网页可能会构建一次，但本次没有改 `index.html`，游戏界面不变。

### 建议删除的历史文件

在确认上述新文件上传正确后，以下文件可从主仓库根目录删除：

- `game.js`（旧独立游戏逻辑；真正 Worker 使用的是 `server/game.js`）
- `apply-upgrade.py`（旧升级脚本）
- `apply-upgrade.mjs`（旧升级脚本）
- `rules.json`（旧补丁规则配置，不是运行中的规则来源）
- `UPLOAD_GUIDE.md`（旧补丁上传说明）

**千万不要删除** `index.html`、`server/game.js`、`server/worker.js`、`wrangler.toml`、`package.json`、`tests/random-events.test.js`、`tests/reveal-stages.test.js`、`tests/room-lifecycle.test.js` 或 `preview/`。删除旧文件前可使用仓库的 Git 历史恢复；如你仍在其他电脑上使用旧补丁脚本，请先保留它们。

## 二、如果今后修改了服务器逻辑

Cloudflare 生产 Worker 目前叫 `my-chuiniubi-room`，其 `ROOMS` Durable Object 绑定类名是 `GameRoom`，语音功能依赖四个 `CF_RTK_*` 配置。不要创建同名新项目，不要误删绑定或把 Token 上传 GitHub。

1. 先在 GitHub 上更新 `server/game.js` / `server/worker.js`（若前端协议也变，需同时更新 `index.html`）。
2. 进入 <https://dash.cloudflare.com/> → **Workers & Pages** → `my-chuiniubi-room`。
3. 看最新 **Deployments** 是否确实包含这次服务器更新。**只看到 GitHub Pages 成功不代表 Worker 成功。**
4. 如果使用 Git 集成自动发布，查看构建与部署记录；若你的项目实际通过 Wrangler 手动发布，则需要在自己的开发环境或原有自动化流程完成部署，**不能只上传 GitHub 后假设它自动更新**。
5. 打开 Worker `/health` 和国内 Pages `/health`，再创建**新房间**测试新规则。已进行中的旧房间尽量不要在对局中升级。

Worker 地址：<https://my-chuiniubi-room.syc050609.workers.dev/health>
备用健康检查：<https://chuiniubi-relay.pages.dev/health>

> 当前 `server/worker.js` 的 `gameplay` 健康检查标识仍可能是旧的 `v7.7.3`。这个字段是手工写死的版本文本。若未来只想修正版本文字，需要在 `server/worker.js` 的 `/health` 响应中修改 `gameplay` 字符串并部署 Worker；语音接口版本 `1.1-voice` 可保持原样。本次修复包不修改 Worker，以避免不必要的重部署。

## 三、中国玩家连接与语音

- 主站：<https://kilemoran.github.io/chuiniubi/>
- 备用入口：<https://chuiniubi-relay.pages.dev/>
- Pages 项目 Service Binding：`GAME` → `my-chuiniubi-room`，环境为 Production。
- `/health` 是 HTTP 测试；`/ws` 是 WebSocket 游戏连接；两者成功**不保证** RealtimeKit 语音在中国网络可用，必须用两台实际设备测试麦克风。
- 语音配置应继续保存在原 Cloudflare Worker 中：`CF_RTK_ACCOUNT_ID`、`CF_RTK_APP_ID`、`CF_RTK_PRESET`、`CF_RTK_API_TOKEN`（Secret）。

## 四、不使用命令行的检查清单

1. GitHub `main` 分支中，`tests/game.test.js`、`tests/joker-rules.test.js` 和 `tests/reveal-stages.test.js` 仍在 `tests` 目录。
2. README 写的是 1–2 人 **54 张**、3–6 人 **108 张**，每副有大小王。
3. 游戏网页的出牌按钮最多 **12 张**，并显示选牌数量。
4. 两秒保护间隔结束后，下一玩家未出牌时仍可质疑上一手。
5. 创建四人新房间，每人初始应为 **27 张**；两人新房间，每人 **27 张**。
6. 四种随机事件均有展示代码，单人模式无随机事件；少量试玩未触发彩蛋是正常的（只有 3% 的总概率）。
7. 语音按钮能请求麦克风，国内/英国玩家分别尝试同房间连接和通话。

若需要回滚，在 GitHub 历史中找到这次维护前的最新提交 `1d3a3ade3ecabe140d1d4b5b094383113b9aff1f`。回滚网页与 GitHub 文件不等于自动回滚 Cloudflare 已部署 Worker；两者分别管理。
