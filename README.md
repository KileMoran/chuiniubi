# 吹牛逼 V7.8 — 大小王万能癞子 / 每手12张 / 实时选牌计数

**开发日期：2026-11-10**

> ⚠️ 本更新包只包含代码补丁，**还没有写入 GitHub 或部署 Cloudflare**。ChatGPT 连接 GitHub 时收到 `403 Resource not accessible by integration`（无写入权限）。不要把“本地测试通过”理解成“线上已上线”。

## 新规则

| 游戏人数 | 用牌 | 备注 |
| --- | --- | --- |
| 1–2 人 | 一副普通牌，52 张 | 暂不加大小王 |
| 3–6 人 | 两副含大小王的牌，108 张 | 2 大王 + 2 小王，共 4 张癞子 |

- **大小王是万能癞子：** 无论本轮宣称 3、7、K、A 等什么合法点数，大小王都算作该点数。质疑时不算假牌。
- **普通假牌仍算假：** 如果一手里同时出了大小王和与宣称不相符的普通牌，质疑仍成功。
- **每次最多12张：** 前后端共同限制；第13张不能再选择，服务端也会拒绝一次出13张的请求。
- **实时已选牌数：** 按钮显示 `出牌 · 已选 X/12`，顶部和选牌预览同步更新。
- **视觉：** 大王、小王有特别牌面与“癞子”标识，桌面公开牌时不会被红色标记为假牌。

## 推荐操作（Windows，使用 Python）

**先备份仓库或保留当前 GitHub commit。** 不建议用旧版 `index.html` 整页覆盖现有版本。

1. 打开主游戏 GitHub 仓库：<https://github.com/KileMoran/chuiniubi>，点击 **Code → Download ZIP**，解压为 `chuiniubi-main`。
2. 把这个补丁包解压后的 **`apply-upgrade.py`、`rules.json` 和 `tests/joker-rules.test.js`** 放进 `chuiniubi-main` 里（补丁文件 `tests/joker-rules.test.js` 放在仓库 `tests/` 目录）。
3. 在 `chuiniubi-main` 文件夹打开 Windows PowerShell 或终端，执行：

   ```powershell
   py apply-upgrade.py .
   ```

   如果没有 `py`，可使用 `python apply-upgrade.py .`。该脚本只在所有目标代码段正确匹配后才开始写入，无法匹配时会停止，不盲目覆盖。
4. 如果已经安装 Node.js，可在该文件夹执行：

   ```powershell
   npm test
   ```

   自动化测试应全部通过。该步骤不需要启动 Cloudflare，也不需要任何 RealtimeKit Token。
5. **提交到 GitHub：** 最省事的方法是用 GitHub Desktop 克隆主仓库，再在它的本地目录执行步骤 2–4，然后在 GitHub Desktop 中 Commit、Push。若使用下载 ZIP 而非克隆仓库，也可以在 GitHub 网页上逐一上传下面列出的正确路径的更新文件，避免把 `server/` 或 `tests/` 文件错误地放在仓库根目录。

## 此次需要更新的 GitHub 文件

- `server/game.js` — 108 张发牌、大小王排序、癞子判定、12 张上限
- `index.html` — 大小王视觉、翻牌真假标记、选牌与按钮实时计数
- `tests/game.test.js` — 旧测试按 108 张、12 张及普通牌判断更新
- `tests/reveal-stages.test.js` — 按真实当前翻牌计时和 108 张更新
- `tests/joker-rules.test.js` — 新增大小王、假牌、12/13 张、隐私测试
- `README.md` — 规则文档（保留跨境联机章节）
- `CHANGELOG.md` — 添加本次改动说明

`apply-upgrade.py`、`apply-upgrade.mjs`、`rules.json` 不必提交到 GitHub（只是本地更新工具）；如果想保留，也可以自行放进 `tools/` 目录再提交。

## 使用 Node.js 的替代方式

把 `apply-upgrade.mjs` 和 `tests/joker-rules.test.js` 放在与上面相同的位置（`rules.json` 只供 Python 版使用），在仓库根目录执行：

```bash
node apply-upgrade.mjs .
npm test
```

## GitHub 更新完成后如何上线

游戏逻辑在 Worker 上运行。**仅提交 GitHub 而没有触发 Cloudflare 的 Worker 更新，线上游戏仍然使用旧牌组。**

1. 确认 GitHub 的 `server/game.js` 和 `index.html` 已更新。
2. 在 Cloudflare 控制台确认原 `my-chuiniubi-room` Worker 已部署包含这次修改的新代码；如果没有自动部署，需要通过主仓库的 Wrangler 配置重新部署。
3. 不要删掉 `wrangler.toml` 中的 `keep_vars = true`，也不要改动 `ROOMS` Durable Objects 绑定和四个 `CF_RTK_*` 语音运行时配置。
4. 让朋友创建一个**新的**三人或四人房间，确认共有 108 张（3人每人36张；4人每人27张），大王和小王各有2张。
5. 双方分别从英国主站、国内备用入口测试同一个房间，确认出牌、掀牌、语音都能正常进行。

**注意：** 已经开始的旧房间不会自动在牌局中增加大小王。请在新部署后重新创建房间验证新规则。

## 实测说明

在隔离的本地副本中运行了 `npm test`：18/18 测试通过，前端 JavaScript 已通过 `node --check` 语法检查；不代表已经在真实两人跨国 WebSocket 房间或 RealtimeKit 语音里完成端到端测试。该更新包不包含任何密钥或个人身份令牌。
