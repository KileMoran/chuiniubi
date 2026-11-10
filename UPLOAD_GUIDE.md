# V7.8 GitHub 网页上传版（无需运行脚本）

这份压缩包已包含修改后的完整文件，不需要执行 Python、JavaScript、PowerShell 或 npm。

## 最容易的操作

1. 在电脑上把本 ZIP 解压。
2. 打开 https://github.com/KileMoran/chuiniubi ，进入 main 分支。
3. 分别打开以下 GitHub 文件并点击铅笔图标（Edit this file）：
   - server/game.js
   - index.html
   - tests/game.test.js
   - tests/reveal-stages.test.js
4. 对每个文件，用压缩包中**同名同路径**文件的完整内容替换，然后点击 Commit changes。
5. tests/joker-rules.test.js 是新增文件：在 GitHub 仓库的 tests 文件夹里选择 Add file → Upload files，上传该文件并提交。
6. 等待 GitHub Pages 和 Cloudflare Worker 的构建部署完成，再创建新房间测试。README、语音密钥、wrangler.toml 及跨国 relay 不用替换。

重要：只是解压文件或保存到本地，并不会自动更新游戏。必须将修改后的文件提交到 GitHub。GitHub 当前连接仅有读取权限，助手无法直接提交。

## 改动

- 1–2 人局：52 张普通牌，保留原样。
- 3–6 人局：2 副含大小王，合计 108 张（两大王、两小王）。
- 大小王可以当作本轮宣称点数，被质疑时不算假牌。
- 一次可出 1–12 张，超过 12 张拒绝。
- 选牌数量动态显示「已选 X / 12 张」。

文件源码基于本次更新前的 V7.7.5 游戏快照及 GitHub 现有测试文件。若你在上传前对同一文件进行了新的代码改动，请先比较差异，避免覆盖新改动。

## 测试

服务器/规则测试 18/18 通过（测试游戏脚本，未完成真实多人浏览器通话测试）。
