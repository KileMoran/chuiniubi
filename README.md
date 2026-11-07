# 吹牛逼 · 真人联机版（4–6 人）

中国大学宿舍纸箱牌桌，朋友通过六位房间号实时联机；无 AI。

> 前端：GitHub Pages；游戏服务器：Cloudflare Workers + Durable Objects。两个服务都必须上线才能真正联机。本仓库与斗地主项目完全独立。

## 一、零命令上线（只使用浏览器）

### 1. 创建 GitHub 仓库

打开 https://github.com/new ：
- Owner 选择 `KileMoran`
- Repository name 填 `chuiniubi`
- 选 Public（用于 GitHub Pages）
- **不要**勾选 Add a README file / .gitignore / License，保持空仓库，点击 Create repository

接着点击空仓库页面上的 **uploading an existing file**（或以后使用 **Add file → Upload files**），上传本文件夹里的 `index.html`、`package.json`、`wrangler.toml` 和 `server/game.js`、`server/worker.js`，确保 `server/` 目录层级保留。网页上传时可以直接拖动整个文件夹或选择解压后的文件（不同浏览器对目录拖动支持不同）；确认上传页面展示正确的相对路径再 Commit changes。

**不能直接上传 ZIP 并期望 GitHub 自动解压。** 推荐先解压 ZIP。

### 2. 用 GitHub Pages 发布网页

仓库页面 → Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/(root)` → Save。

部署后预计网页地址为：`https://kilemoran.github.io/chuiniubi/`。

### 3. 在 Cloudflare 建立新 Worker（无需本机安装 Node.js）

Cloudflare Dashboard → Workers & Pages → Create application → GitHub（或 Import a repository）→ 选择 `KileMoran/chuiniubi`。

按以下参数确认：
- **Worker 名称：** `my-chuiniubi-room`（必须与 `wrangler.toml` 中的 `name` 完全一致）
- **Production branch：** `main`
- **Root directory：** 留空（仓库根目录）
- **Build command：** 留空（本项目无构建步骤）
- **Deploy command：** `npx wrangler deploy`（默认即可）

点击 **Save and Deploy**。Cloudflare 会在云端安装依赖、部署 Worker，并根据 `wrangler.toml` 创建 Durable Object。此时 Cloudflare 与 GitHub 建立自动部署关联，之后提交到 main 可触发新的部署。

如果 Cloudflare 提示缺少 Worker 名称、Durable Objects 绑定、账单配置或 GitHub 仓库权限，请根据具体错误处理；不要选择原来斗地主的 Worker。

### 4. 检查联机地址

如果仍在之前的 Cloudflare 账号与 `syc050609.workers.dev` 子域名下，游戏已预设服务器地址：

`wss://my-chuiniubi-room.syc050609.workers.dev`

部署后在浏览器访问：`https://my-chuiniubi-room.syc050609.workers.dev/health`。
正常应返回含 `"ok":true` 的 JSON。如果 Cloudflare 控制台实际地址不同，在游戏首页的「高级设置」里填写实际地址（`wss://...workers.dev`）。

**预设地址目前不代表已成功部署。**

## 二、4 人首次测试

1. 房主打开游戏首页，填写昵称，房间总人数选择 4，点击「创建新房间」。
2. 把邀请链接发给另外三名朋友，让他们分别在不同浏览器/设备打开并加入。
3. 房主看到 4 人齐全、全部在线之后再开始。
4. 检查各玩家只看到自己的手牌；出牌后全场同步；质疑后才亮出牌；本轮所有其他玩家跳过则暗牌弃置。

## 三、注意事项

- Cloudflare Worker 与 GitHub Pages 分别部署；只发布网页，房间无法连接。
- `wrangler.toml` 中 Worker 名必须与 Cloudflare 控制台 Worker 名一致。
- 因账号不同，Worker 的实际子域名可能与预设值不一致。
- 不要把原来的 `my-doudizhu-room` Worker 改名或覆盖。
- 服务器隐藏其他玩家的手牌并校验出牌。房间号不是密码，不适合陌生人隐私社交。
- 游戏中玩家断线会暂停该人的回合等待重连；当前没有自动托管和踢人功能。

## 四、项目结构

```
index.html         # 游戏客户端（宿舍场景、样式、头像、脚本内置）
package.json       # Cloudflare 云端构建依赖
wrangler.toml      # Worker 和 Durable Objects 配置
server/
  game.js          # 服务器规则引擎
  worker.js        # WebSocket 房间服务
```

游戏规则逻辑本地已经通过单元测试，但上线后的多设备联机仍需实际验证。

官方文档：
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
