#!/usr/bin/env python3
# 版本 V7.8：针对已有主游戏仓库的增量更新，不覆盖 server/worker.js、wrangler.toml 或 Pages 代码。
import json
import shutil
import sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '.').expanduser().resolve()
here=Path(__file__).resolve().parent
rules=json.loads((here/'rules.json').read_text(encoding='utf-8'))
write={}
for file,steps in rules:
    path=root/file
    if not path.exists():
        raise SystemExit(f'找不到 {file}；请把更新包的三个文件放在主游戏仓库根目录后执行。')
    src=path.read_text(encoding='utf-8')
    for before,after,why in steps:
        if why=='新增大小王常量' and 'export const JOKER_RANKS' in src: continue
        if why=='大小王和计数高亮CSS' and '/* Wild jokers: clearly marked' in src: continue
        n=src.count(before)
        if n==1:src=src.replace(before,after,1)
        elif n==0 and after in src:continue
        else:raise SystemExit(f'安全检查失败：{file} 的 {why}（匹配到 {n} 处）。没有写入任何文件。请确认下载的是最新版 GitHub 源码。')
    write[file]=src
# 旧断言：4–6 人正常局为 104，最新版已改为 108。保留单人 52 张检查。
write['tests/game.test.js']=write['tests/game.test.js'].replace('assert.equal(totalCards(g),104)','assert.equal(totalCards(g),108)').replace('assert.equal(totalCards(h),104)','assert.equal(totalCards(h),108)')
readme=root/'README.md'
if readme.exists():
    r=readme.read_text(encoding='utf-8')
    r=r.replace('没有 Joker/大小王。**1–2 人用 1 副（52 张），3–6 人用 2 副（104 张）。**','1–2 人仍不含大小王：一副 52 张；3–6 人使用两副含大小王的牌，共 108 张（2 张大王、2 张小王）。')
    r=r.replace('1–2 人：1 副（52 张）；3–6 人：2 副（104 张）；**无大小王**','1–2 人：52 张（无大小王）；3–6 人：108 张（两副含大小王）')
    r=r.replace('1–2 人 1 副、3–6 人 2 副','1–2 人 1 副（52 张）；3–6 人 2 副含大小王（108 张）')
    r=r.replace('选择 **1–8 张**牌','选择 **1–12 张**牌').replace('选中的 1–8 张手牌','选中的 1–12 张手牌').replace('超过 8 张牌的出牌请求应被拒绝','超过 12 张牌的出牌请求应被拒绝')
    if '### 4.1.1 大小王万能癞子' not in r:
        extra='''### 4.1.1 大小王万能癞子（2026-11-10）

3–6 人的每副牌包含 52 张普通牌、1 张大王、1 张小王；两副合计 **108 张**。**大王和小王可以当作本轮宣称的任意点数**。如果宣称 7，出大小王算作真牌；如果同一次出牌还包含不符合宣称点数的普通牌，质疑仍成功。揭牌时大小王显示“癞子”，不标记“假牌”。

每次最多选择 **12 张**，游戏会实时显示“已选 X/12 张”。1–2 人仍使用 52 张普通牌，不含大小王。

### 4.2 发牌与先手'''
        r=r.replace('### 4.2 发牌与先手',extra,1)
    write['README.md']=r
changelog=root/'CHANGELOG.md'
if changelog.exists():
    c=changelog.read_text(encoding='utf-8')
    if '## V7.8 — 大小王万能癞子' not in c:
        c='''## V7.8 — 大小王万能癞子 / 12 张上限 / 实时选牌计数（2026-11-10）

- 3–6 人局两副牌共 108 张，含 2 大王、2 小王；1–2 人仍为 52 张。
- 大小王可当作当前宣称的任意点数；非癞子的普通假牌仍会被质疑成功。
- 每次最多出 12 张，出牌按钮和选牌区域实时显示“已选 X/12 张”。
- 大小王使用不同的牌面和“癞子”标签；保留原来的翻牌、收牌、语音和跨国联机逻辑。

'''+c
        write['CHANGELOG.md']=c
new_test=root/'tests/joker-rules.test.js'
if not new_test.exists():write['tests/joker-rules.test.js']=(here/'tests/joker-rules.test.js').read_text(encoding='utf-8')
# All replacements have now been verified; write only after successful preflight.
for file,content in write.items():
    p=root/file
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(content,encoding='utf-8')
    print('已更新:',file)
print('\n完成。请运行 npm test，并把更新过的文件提交到 GitHub。未修改 Cloudflare 或 GitHub 线上仓库。')
