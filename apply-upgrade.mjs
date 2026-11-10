#!/usr/bin/env node
// 读取目标目录里已经存在的最新 GitHub 仓库文件，进行最小范围的、严格匹配的安全替换。
// 不修改 server/worker.js、wrangler.toml、Cloudflare 环境变量或 Pages 备用入口。
import {readFileSync,writeFileSync,existsSync,copyFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const project=resolve(process.argv[2]||'.');
const source=dirname(fileURLToPath(import.meta.url));
const modified=[];
function update(path,steps){
 const absolute=join(project,path);
 if(!existsSync(absolute))throw new Error(`找不到 ${path}，请在完整主游戏仓库根目录执行`);
 let text=readFileSync(absolute,'utf8');
 for(const [from,to,why] of steps){
  if(why==='大小王和计数高亮CSS'&&text.includes('/* Wild jokers: clearly marked')){console.log('CSS已存在，跳过');continue;}
  if(why==='新增大小王常量'&&text.includes('export const JOKER_RANKS')){console.log('大小王常量已存在，跳过');continue;}
  const hits=text.split(from).length-1;
  if(hits===1){text=text.replace(from,to);}
  else if(hits===0&&text.includes(to)){console.log('已修改过，跳过:',path,why);}
  else throw new Error(`${path}：无法唯一定位「${why}」（匹配 ${hits} 处）。为了避免覆盖新版改动，已中止`);
 }
 modified.push({path,content:text});
}
const updates = [
['server/game.js',[
 ["export const RANKS = ['2','A','K','Q','J','10','9','8','7','6','5','4','3'];", "export const RANKS = ['2','A','K','Q','J','10','9','8','7','6','5','4','3'];\nexport const JOKER_RANKS = ['大王','小王'];\nexport const MAX_PLAY_CARDS = 12;\nexport const isJoker = card => !!card && JOKER_RANKS.includes(card.rank);",'新增大小王常量'],
 ["// 1–2 玩家：一副（52张）；3–6 玩家：两副（104张）。", "// 1–2 玩家：普通一副（52张）；3–6 玩家：两副含大小王（108张，2大王+2小王）。",'牌数注释'],
 ["export function expectedCardCount(capacity){return 52*deckCountForCapacity(capacity);}","export function expectedCardCount(capacity){return capacity<=2?52:108;}",'108张总牌数'],
 ["export function sortCards(a){return a.sort((x,y)=>RANKS.indexOf(x.rank)-RANKS.indexOf(y.rank)||SUITS.indexOf(x.suit)-SUITS.indexOf(y.suit));}","export function sortCards(a){const ranks=[...JOKER_RANKS,...RANKS];return a.sort((x,y)=>ranks.indexOf(x.rank)-ranks.indexOf(y.rank)||SUITS.indexOf(x.suit)-SUITS.indexOf(y.suit));}",'大小王排序'],
 ["const deck=[];let id=0;for(let d=0;d<deckCountForCapacity(g.capacity);d++)for(const r of RANKS)for(const s of SUITS)deck.push({id:`c${id++}`,rank:r,suit:s});shuffle(deck);","const deck=[];let id=0;for(let d=0;d<deckCountForCapacity(g.capacity);d++){for(const r of RANKS)for(const s of SUITS)deck.push({id:`c${id++}`,rank:r,suit:s});if(g.capacity>=3)for(const rank of JOKER_RANKS)deck.push({id:`c${id++}`,rank,suit:'🃏'});}shuffle(deck);",'四张大小王入牌'],
 ["err(Array.isArray(ids)&&ids.length>=1&&ids.length<=8,'每次只能出1–8张牌');","err(Array.isArray(ids)&&ids.length>=1&&ids.length<=MAX_PLAY_CARDS,'每次只能出1–12张牌');",'12张服务端上限'],
 ["const lied=g.pile.some(p=>p.moveId===move.moveId&&p.card.rank!==move.rank);","const lied=g.pile.some(p=>p.moveId===move.moveId&&!isJoker(p.card)&&p.card.rank!==move.rank);",'大小王作为万能真牌']
]],
['index.html',[
 ["const rankOrder=['2','A','K','Q','J','10','9','8','7','6','5','4','3'];","const rankOrder=['2','A','K','Q','J','10','9','8','7','6','5','4','3'];\nconst MAX_PLAY_CARDS=12;\nconst isJokerCard=card=>!!card&&(card.rank==='大王'||card.rank==='小王');",'前端大小王识别'],
 ["<span id=\"selectedCount\">已选 0 / 8 张</span>","<span id=\"selectedCount\" class=\"selected-count\" aria-live=\"polite\">已选 0 / 12 张</span>",'选中牌实时计数标签'],
 ["<b id=\"pickedCount\">0/8</b>","<b id=\"pickedCount\">0/12</b>",'选中预览计数'],
 ["const isFalse=shown&&p.moveId===state.last?.moveId&&p.card.rank!==state.rank;","const isFalse=shown&&p.moveId===state.last?.moveId&&!isJokerCard(p.card)&&p.card.rank!==state.rank;",'癞子不能显示假牌'],
 ["front.className='pile-face pile-front'+(red?' red':'');","front.className='pile-face pile-front'+(red?' red':'')+(isJokerCard(p.card)?' joker':'');",'摊牌大小王样式'],
 ['<span class="pile-symbol">${esc(p.card.suit)}</span><span class="fake-label">假牌</span>', '<span class="pile-symbol">${esc(p.card.suit)}</span>${isJokerCard(p.card)?\'<span class="joker-badge">癞子</span>\':\'\'}<span class="fake-label">假牌</span>','摊牌大小王癞子提示'],
 ["const red='♥♦'.includes(c.suit),sel=selected.has(c.id);return `<span class=\"hand-card ${red?'red':''} ${sel?'selected':''}\"","const red='♥♦'.includes(c.suit),sel=selected.has(c.id),joker=isJokerCard(c);return `<span class=\"hand-card ${red?'red':''} ${joker?'joker '+(c.rank==='大王'?'joker-big':'joker-small'):''} ${sel?'selected':''}\"",'手牌大小王样式'],
 ["<span class=\"hand-suit\">${c.suit}</span>${sel?'<span class=\"hand-check\">✓</span>':''}","<span class=\"hand-suit\">${c.suit}</span>${joker?'<span class=\"joker-badge\">癞子</span>':''}${sel?'<span class=\"hand-check\">✓</span>':''}",'手牌大小王癞子标签'],
 ["$('selectedCount').textContent=`已选 ${selected.size} / 8 张`;","$('selectedCount').textContent=`已选 ${selected.size} / ${MAX_PLAY_CARDS} 张`;$('selectedCount').classList.toggle('has-selection',selected.size>0);",'实时选择数字'],
 ["$('pickedCount').textContent=`${cards.length}/8`;","$('pickedCount').textContent=`${cards.length}/${MAX_PLAY_CARDS}`;",'实时预览数字'],
 ["<button class=\"picked-card ${'♥♦'.includes(c.suit)?'red':''}\"","<button class=\"picked-card ${'♥♦'.includes(c.suit)?'red':''} ${isJokerCard(c)?'joker':''}\"",'预览大小王样式'],
 ["else if(selected.size>=8){toast('每次最多选8张');return;}","else if(selected.size>=MAX_PLAY_CARDS){toast('每次最多选12张');return;}",'点击最多选择12张'],
 ["selected.size<1||selected.size>8||(!state.rank&&!rank.value)","selected.size<1||selected.size>MAX_PLAY_CARDS||(!state.rank&&!rank.value)",'出牌按钮校验12张'],
 ["$('playBtn').textContent=selected.size?`出牌 (${selected.size})`:'出牌';","$('playBtn').textContent=`出牌 · 已选 ${selected.size}/${MAX_PLAY_CARDS}`;",'出牌按钮实时数字'],
 ["'轮到你 · 点选1–8张牌后出牌'","'轮到你 · 点选1–12张牌后出牌'",'操作文字12张'],
 ["</style></head><body>","/* Wild jokers: clearly marked in hands, tabletop reveal and selection tray. */\n.hand-card.joker{background:linear-gradient(155deg,#fff9e4,#e6cf98);color:#603b15;border:2px solid #c99d3e;box-shadow:0 1px 14px #dcb35e72}\n.hand-card.joker.joker-big{border-color:#d16c40;background:linear-gradient(155deg,#fff1d8,#f1b78d)}\n.hand-card.joker .hand-corner{font-size:clamp(12px,1.4vw,17px);line-height:1.25;white-space:nowrap}\n.hand-card.joker .hand-suit{font-size:clamp(24px,3.2vw,36px)}\n.hand-card .joker-badge{position:absolute;bottom:9px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:1000;padding:1px 5px;border-radius:4px;background:#754c21;color:#fff0c9;white-space:nowrap;pointer-events:none}\n.pile-front.joker{border-color:#d8a94e!important;background:#fff4dc!important}\n.pile-front.joker .pile-rank{font-size:clamp(10px,1.5vw,16px)}\n.pile-front .joker-badge{position:absolute;bottom:3px;left:50%;transform:translateX(-50%);padding:1px 3px;border-radius:4px;background:#835824;color:#fff4df;font-size:9px;font-weight:900;white-space:nowrap}\n.picked-card.joker{border-color:#dca44d;background:#45301b;color:#ffe6b6}\n.selected-count{font-weight:1000;color:#f6d59b;white-space:nowrap}\n.selected-count.has-selection{color:#92ffc1;text-shadow:0 0 12px #43d49266}\n</style></head><body>",'大小王和计数高亮CSS']
]],
['tests/game.test.js',[
 ["playerIndex,RANKS} from '../server/game.js';","playerIndex,RANKS,isJoker} from '../server/game.js';",'测试引用 isJoker'],
 ["beginTurn(g);assert.equal(totalCards(g),104);return g;}","beginTurn(g);assert.equal(totalCards(g),n<=2?52:108);return g;}",'setup 手牌总数'],
 ["test('4/5/6人发牌，全部104张守恒","test('4/5/6人发牌，全部108张守恒",'4~6人数量测试标题'],
 ["const starter=g.turn;const fakeRank=RANKS.find(x=>x!==g.players[starter].hand[0].rank);playCards(g,tokens[starter],[g.players[starter].hand[0].id],fakeRank);","const starter=g.turn;const normal=g.players[starter].hand.find(c=>!isJoker(c));const fakeRank=RANKS.find(x=>x!==normal.rank);playCards(g,tokens[starter],[normal.id],fakeRank);",'稳定选择普通假牌'],
 ["const i=g.turn,card=g.players[i].hand[0];playCards(g,tokens[i],[card.id],card.rank);","const i=g.turn,card=g.players[i].hand.find(c=>!isJoker(c));playCards(g,tokens[i],[card.id],card.rank);",'稳定选择普通真牌'],
 ["test('非自己回合出牌、重复牌、超8张、质疑自己全部被拒绝'","test('非自己回合出牌、重复牌、超12张、质疑自己全部被拒绝'",'边界测试标题'],
 ["g.players[i].hand.slice(0,9).map(c=>c.id)","g.players[i].hand.slice(0,13).map(c=>c.id)",'第13张被拒绝'],
 ["const keep=own[0];g.players[(i+1)%4].hand.push(...own.slice(1));g.players[i].hand=[keep];","const keep=own.find(c=>!isJoker(c));g.players[(i+1)%4].hand.push(...own.filter(c=>c.id!==keep.id));g.players[i].hand=[keep];",'稳定选普通牌测胜利'],
 ["const h=setup(4),j=h.turn;const card=h.players[j].hand[0];","const h=setup(4),j=h.turn;const card=h.players[j].hand.find(c=>!isJoker(c));",'稳定选普通假牌测失败'],
 ["test('1–6人发牌精确匹配副数：1–2人52张、3人208张、4–6人104张'","test('1–6人发牌精确匹配副数：1–2人52张、3–6人108张'",'副牌测试标题'],
 ["const expected=n<=2?52:n===3?208:104;","const expected=n<=2?52:108;",'副牌测试 expected'],
 ["expected/52);","n<=2?1:2);",'副牌数量显示断言'],
 ["const first=g.players[g.turn].hand[0];","const first=g.players[g.turn].hand.find(c=>!isJoker(c));",'避免首牌恰是大小王'],
 ["const g=setup(4),i=g.turn,first=g.players[i].hand[0];","const g=setup(4),i=g.turn,first=g.players[i].hand.find(c=>!isJoker(c));",'首手宣称校验'],
 ["const j=g.turn,second=g.players[j].hand[0];","const j=g.turn,second=g.players[j].hand.find(c=>!isJoker(c));",'新回合宣称校验'],
 ]],
 ['tests/reveal-stages.test.js',[
  ["assert.ok(g.phaseUntil-Date.now()>=6000,'揭牌展示留出查看时间');","assert.ok(g.phaseUntil-Date.now()>=2000,'揭牌展示留出查看时间');",'揭牌等待时间测试匹配当前线上计时'],
  ["assert.equal(totalCards(g),208);","assert.equal(totalCards(g),108);",'三人张数测试']
 ]]
];
if(process.argv.includes('--dump')){writeFileSync(join(source,'rules.json'),JSON.stringify(updates,null,2),'utf8');console.log('已导出 rules.json');process.exit(0);}
for(const [p,x] of updates)update(p,x);
// 对现有测试里所有准确的“正常人数牌数为 104”的断言进行整体同步（保留单人 52 张）。
const test=modified.find(x=>x.path==='tests/game.test.js');
test.content=test.content.replaceAll('assert.equal(totalCards(g),104)', 'assert.equal(totalCards(g),108)').replaceAll('assert.equal(totalCards(h),104)', 'assert.equal(totalCards(h),108)');
// README/CHANGELOG 仅更新玩法说明，不更改历史版本记录。
const readmePath=join(project,'README.md');
if(existsSync(readmePath)){
 let r=readFileSync(readmePath,'utf8');
 r=r.replace('没有 Joker/大小王。**1–2 人用 1 副（52 张），3–6 人用 2 副（104 张）。**','1–2 人仍不含大小王：一副 52 张；3–6 人使用两副含大小王的牌，共 108 张（2 张大王、2 张小王）。');
 r=r.replaceAll('1–2 人：1 副（52 张）；3–6 人：2 副（104 张）；**无大小王**','1–2 人：52 张（无大小王）；3–6 人：108 张（两副含大小王）');
 r=r.replaceAll('1–2 人 1 副、3–6 人 2 副','1–2 人 1 副（52 张）；3–6 人 2 副含大小王（108 张）');
 r=r.replaceAll('选择 **1–8 张**牌','选择 **1–12 张**牌').replaceAll('选中的 1–8 张手牌','选中的 1–12 张手牌').replaceAll('超过 8 张牌的出牌请求应被拒绝','超过 12 张牌的出牌请求应被拒绝');
 r=!r.includes('### 4.1.1 大小王万能癞子')?r.replace('### 4.2 发牌与先手',`### 4.1.1 大小王万能癞子（2026-11-10）\n\n3–6 人的每副牌有 52 张普通牌、1 张大王、1 张小王；两副合计 **108 张**。**大王和小王可以当作本轮宣称的任意点数**（例如宣称 7 时，大小王算作 7）；即使出牌中全部都是大小王，只要宣称点数有效，质疑仍判为真牌。**但只要同一次出牌中存在不符合宣称点数的普通牌，质疑仍然成功**。揭牌时大小王会标明“癞子”，不能显示“假牌”。\n\n每次最多可选 **12 张**，出牌区域实时显示“已选 X/12 张”；这个规则同时适用于不含大小王的 1–2 人房间。1–2 人仍用 52 张普通牌，暂不加入大小王。\n\n### 4.2 发牌与先手`):r;
 modified.push({path:'README.md',content:r});
}
const changePath=join(project,'CHANGELOG.md');
if(existsSync(changePath)){
 const ch=readFileSync(changePath,'utf8');
 if(!ch.includes('## V7.8 — 大小王万能癞子'))modified.push({path:'CHANGELOG.md',content:`## V7.8 — 大小王万能癞子 / 12 张上限 / 实时选牌计数（2026-11-10）\n\n- 3–6 人局改为两副含大小王的牌，总计 108 张（2 大王 + 2 小王）；1–2 人仍为 52 张。\n- 大小王属于万能癞子，永远可视为当轮宣称点数；普通不符点数的牌仍按原规则判假。\n- 每次最多出 12 张；服务端和前端同步校验。\n- 出牌按钮、上方状态和选牌预览实时显示“已选 X/12 张”，有大小王专属牌面和“癞子”标签。\n- 不修改原有翻牌阶段计时、断线恢复、跨国联机及 RealtimeKit 配置。\n\n${ch}`});
}
const newTestFile='tests/joker-rules.test.js';
const newTestSource=readFileSync(join(source,'tests/joker-rules.test.js'),'utf8');
if(!existsSync(join(project,newTestFile)))modified.push({path:newTestFile,content:newTestSource});
// 先验证全部文件，再写入，避免只改一半。
for(const {path,content} of modified){if(!content.length)throw Error(`修改后文件为空：${path}`);if(path==='index.html'){if(!content.includes('MAX_PLAY_CARDS=12')||!content.includes('isJokerCard(p.card)'))throw Error('前端大小王校验丢失')}}
for(const {path,content} of modified){mkdirSync(dirname(join(project,path)),{recursive:true});writeFileSync(join(project,path),content,'utf8');console.log('更新:',path)}
console.log('\n✅ 代码已更新。运行 npm test 验证，然后提交以上文件；server/worker.js 和 wrangler.toml 未改动。');
