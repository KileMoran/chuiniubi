import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,addPlayer,startGame,beginTurn,playCards,passTurn,challenge,resolveAccuse,revealRemaining,startCollect,completeCollect,finishCooldown,finishDiscard,totalCards,publicState,playerIndex,RANKS} from '../server/game.js';
const tokens=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
function setup(n=5){const g=freshGame('ABC123',n);for(let i=0;i<n;i++)addPlayer(g,tokens[i],`玩家${i}`);startGame(g,tokens[0],tokens.slice(0,n));beginTurn(g);assert.equal(totalCards(g),104);return g;}
function firstMove(g,n=3){const i=g.turn,rank=g.rank||'3';const ids=g.players[i].hand.slice(0,n).map(x=>x.id);playCards(g,tokens[i],ids,rank);return i;}
function assertSecret(g){for(let i=0;i<g.players.length;i++){const state=publicState(g,tokens[i],tokens.slice(0,g.players.length));assert.equal(state.hand.length,g.players[i].hand.length);assert.ok(!JSON.stringify(state).includes(tokens[(i+1)%g.players.length]),'绝不能向他人公开私有的玩家凭证');if(!['reveal','collecting','reveal_last'].includes(g.phase)){assert.ok(state.pile.every(p=>!('card' in p)),`泄漏了第${i}个玩家的牌`);}}}
test('4/5/6人发牌，全部104张守恒；对手看不到暗牌',()=>{for(const n of [4,5,6]){const g=setup(n);const sizes=g.players.map(p=>p.hand.length);assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);firstMove(g);assertSecret(g);assert.equal(totalCards(g),104);}});
test('全员不出后原封不动弃牌，由最后出牌者先手',()=>{const g=setup(5),first=firstMove(g,4);finishCooldown(g);for(let i=0;i<4;i++){assert.equal(g.phase,'playing');passTurn(g,tokens[g.turn]);}assert.equal(g.phase,'discarding');assert.equal(g.pile.length,4);finishDiscard(g);assert.equal(g.discard.length,4);assert.equal(g.pile.length,0);assert.equal(g.turn,first);assert.equal(g.rank,null);assert.equal(g.round,2);assert.equal(totalCards(g),104);});
test('骗牌被抓：骗子收所有暗牌；先手归质疑者',()=>{const g=setup(4);const starter=g.turn;const fakeRank=RANKS.find(x=>x!==g.players[starter].hand[0].rank);playCards(g,tokens[starter],[g.players[starter].hand[0].id],fakeRank);let challenger=(starter+1)%4;challenge(g,tokens[challenger]);assert.equal(g.phase,'accusing');assertSecret(g);resolveAccuse(g);assert.equal(g.result.lied,true);assert.equal(g.result.receiver,starter);assert.equal(g.result.starter,challenger);assert.equal(g.phase,'reveal_last');assert.ok(publicState(g,tokens[0]).pile[0].card);revealRemaining(g);startCollect(g);completeCollect(g);assert.equal(g.turn,challenger);assert.equal(totalCards(g),104);});
test('质疑真牌失败：质疑者收牌，真实出牌者继续先手',()=>{const g=setup(4);const i=g.turn,card=g.players[i].hand[0];playCards(g,tokens[i],[card.id],card.rank);const challenger=(i+1)%4;challenge(g,tokens[challenger]);resolveAccuse(g);assert.equal(g.result.lied,false);assert.equal(g.result.receiver,challenger);assert.equal(g.result.starter,i);revealRemaining(g);startCollect(g);completeCollect(g);assert.equal(g.turn,i);assert.equal(totalCards(g),104);});
test('非自己回合出牌、重复牌、超8张、质疑自己全部被拒绝',()=>{const g=setup(4),i=g.turn,another=(i+1)%4;assert.throws(()=>playCards(g,tokens[another],[g.players[another].hand[0].id],'3'));
const one=g.players[i].hand[0].id;assert.throws(()=>playCards(g,tokens[i],[one,one],'3'));assert.throws(()=>playCards(g,tokens[i],g.players[i].hand.slice(0,9).map(c=>c.id),'3'));playCards(g,tokens[i],[one],'3');assert.throws(()=>challenge(g,tokens[i]));assert.equal(totalCards(g),104);});
test('最后一手真牌质疑失败可获胜；假牌被抓不能获胜',()=>{const g=setup(4),i=g.turn;const own=g.players[i].hand; // artificial but card-conserving setup: move extra cards to another player's hand
 const keep=own[0];g.players[(i+1)%4].hand.push(...own.slice(1));g.players[i].hand=[keep];
 playCards(g,tokens[i],[keep.id],keep.rank);challenge(g,tokens[(i+1)%4]);resolveAccuse(g);revealRemaining(g);startCollect(g);completeCollect(g);assert.equal(g.winner,i);assert.equal(g.phase,'finished');assert.equal(totalCards(g),104);
 const h=setup(4),j=h.turn;const card=h.players[j].hand[0];h.players[(j+1)%4].hand.push(...h.players[j].hand.slice(1));h.players[j].hand=[card];const lie=RANKS.find(r=>r!==card.rank);playCards(h,tokens[j],[card.id],lie);challenge(h,tokens[(j+1)%4]);resolveAccuse(h);revealRemaining(h);startCollect(h);completeCollect(h);assert.equal(h.winner,null);assert.ok(h.players[j].hand.length>=1);assert.equal(totalCards(h),104);});

// V7.7: new lobby sizes, explicit rank claims, and conservation across configurable decks.
test('1–6人发牌精确匹配副数：1–2人52张、3人208张、4–6人104张',()=>{
 for(const n of [1,2,3,4,5,6]){
  const g=freshGame('CARD77',n);
  for(let i=0;i<n;i++)addPlayer(g,tokens[i],`玩家${i+1}`);
  startGame(g,tokens[0],tokens.slice(0,n));beginTurn(g);
  const expected=n<=2?52:n===3?208:104;
  assert.equal(totalCards(g),expected,`${n} 人牌总数`);
  assert.equal(publicState(g,tokens[0],tokens.slice(0,n)).deckCount,expected/52);
  const sizes=g.players.map(p=>p.hand.length);
  assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1,`${n} 人发牌不均`);
  const first=g.players[g.turn].hand[0];
  playCards(g,tokens[g.turn],[first.id],first.rank);
  assert.equal(totalCards(g),expected,`${n} 人首次出牌后守恒`);
 }
});
test('每轮第一手必须明确选择宣称点数；沿用上一轮的空值不能出牌',()=>{
 const g=setup(4),i=g.turn,first=g.players[i].hand[0];
 assert.throws(()=>playCards(g,tokens[i],[first.id],undefined),/请选择正确点数/);
 assert.throws(()=>playCards(g,tokens[i],[first.id],''),/请选择正确点数/);
 assert.throws(()=>playCards(g,tokens[i],[first.id],'1'),/请选择正确点数/);
 playCards(g,tokens[i],[first.id],'3');
 challenge(g,tokens[(i+1)%4]);resolveAccuse(g);revealRemaining(g);startCollect(g);completeCollect(g);
 assert.equal(g.rank,null);
 const j=g.turn,second=g.players[j].hand[0];
 assert.throws(()=>playCards(g,tokens[j],[second.id],''),/请选择正确点数/);
 playCards(g,tokens[j],[second.id],'K');
 assert.equal(g.rank,'K');
});
test('单人练习每手自动清桌、重置点数，直到52张出完获胜',()=>{
 const g=freshGame('SOLO77',1);addPlayer(g,tokens[0],'练习者');startGame(g,tokens[0],[tokens[0]]);beginTurn(g);
 let moves=0;
 while(g.phase!=='finished' && moves<20){
  const before=g.players[0].hand.length;
  const ids=g.players[0].hand.slice(0,8).map(c=>c.id);
  playCards(g,tokens[0],ids,'A');
  assert.equal(totalCards(g),52);
  finishCooldown(g);
  moves++;
  assert.equal(totalCards(g),52);
  if(g.phase==='playing'){
   assert.equal(g.turn,0);assert.equal(g.rank,null);
   assert.equal(g.pile.length,0);
   assert.equal(g.discard.length,52-g.players[0].hand.length);
   assert.ok(g.players[0].hand.length<before);
  }
 }
 assert.equal(moves,7);assert.equal(g.phase,'finished');assert.equal(g.winner,0);assert.equal(g.players[0].hand.length,0);
});
test('双人可跟牌、可质疑，质疑结束重开空点数回合',()=>{
 const g=freshGame('DUO777',2);for(let i=0;i<2;i++)addPlayer(g,tokens[i],`玩家${i}`);
 startGame(g,tokens[0],tokens.slice(0,2));beginTurn(g);
 const i=g.turn,j=(i+1)%2,rank='Q';
 playCards(g,tokens[i],[g.players[i].hand[0].id],rank);
 challenge(g,tokens[j]);resolveAccuse(g);revealRemaining(g);startCollect(g);completeCollect(g);
 assert.equal(g.round,2);assert.equal(g.rank,null);assert.equal(g.phase,'playing');
 assert.equal(totalCards(g),52);
});
