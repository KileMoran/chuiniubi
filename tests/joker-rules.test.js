import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,addPlayer,startGame,beginTurn,playCards,challenge,resolveAccuse,publicState,totalCards,expectedCardCount,isJoker,MAX_PLAY_CARDS} from '../server/game.js';
const ids=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
function setup(n){const g=freshGame('JKR888',n);for(let i=0;i<n;i++)addPlayer(g,ids[i],`玩家${i+1}`);startGame(g,ids[0],ids.slice(0,n));beginTurn(g);return g;}
function giveTurnPlayerJoker(g){const to=g.turn;let card=g.players[to].hand.find(isJoker);if(card)return card;const from=g.players.findIndex(p=>p.hand.some(isJoker));assert.ok(from>=0);const index=g.players[from].hand.findIndex(isJoker);card=g.players[from].hand.splice(index,1)[0];g.players[to].hand.push(card);return card;}
test('1–2人普通52张，3–6人108张并且准确含2大王+2小王',()=>{
 for(let n=1;n<=6;n++){const g=setup(n);const all=g.players.flatMap(p=>p.hand);assert.equal(all.length,n<=2?52:108);assert.equal(expectedCardCount(n),all.length);assert.equal(all.filter(c=>c.rank==='大王').length,n<=2?0:2);assert.equal(all.filter(c=>c.rank==='小王').length,n<=2?0:2);assert.equal(new Set(all.map(c=>c.id)).size,all.length);assert.equal(publicState(g,ids[0],ids.slice(0,n)).deckCount,n<=2?1:2);assert.ok(Math.max(...g.players.map(p=>p.hand.length))-Math.min(...g.players.map(p=>p.hand.length))<=1);}
});
test('一手允许12张，拒绝13张，且牌数守恒',()=>{
 const g=setup(4),i=g.turn,own=g.players[i].hand,thirteen=own.slice(0,13).map(c=>c.id);assert.equal(MAX_PLAY_CARDS,12);assert.throws(()=>playCards(g,ids[i],thirteen,'7'),/1–12/);assert.equal(totalCards(g),108);playCards(g,ids[i],thirteen.slice(0,12),'7');assert.equal(g.last.count,12);assert.equal(g.pile.length,12);assert.equal(totalCards(g),108);
});
test('单张大小王可以充当任意宣称点数，质疑判真',()=>{
 const g=setup(3),i=g.turn,j=(i+1)%3,joker=giveTurnPlayerJoker(g);assert.ok(isJoker(joker));playCards(g,ids[i],[joker.id],'K');challenge(g,ids[j]);resolveAccuse(g);assert.equal(g.result.lied,false);assert.equal(g.result.receiver,j);assert.equal(totalCards(g),108);
 const shown=publicState(g,ids[0],ids.slice(0,3));assert.equal(shown.phase,'reveal_last');assert.equal(shown.pile[0].card.rank,joker.rank);
});
test('癞子加一张正常宣称点数，质疑判真',()=>{
 const g=setup(4),i=g.turn,j=(i+1)%4,joker=giveTurnPlayerJoker(g);const natural=g.players[i].hand.find(c=>!isJoker(c));playCards(g,ids[i],[joker.id,natural.id],natural.rank);challenge(g,ids[j]);resolveAccuse(g);assert.equal(g.result.lied,false);assert.equal(totalCards(g),108);
});
test('癞子无法掩盖同一次出牌中普通牌的谎报',()=>{
 const g=setup(5),i=g.turn,j=(i+1)%5,joker=giveTurnPlayerJoker(g);const normal=g.players[i].hand.find(c=>!isJoker(c));const fake=['3','4','5','6','7','8','9','10','J','Q','K','A','2'].find(r=>r!==normal.rank);playCards(g,ids[i],[joker.id,normal.id],fake);challenge(g,ids[j]);resolveAccuse(g);assert.equal(g.result.lied,true);assert.equal(g.result.receiver,i);assert.equal(totalCards(g),108);
});
test('质疑前不提前向其他玩家公开大小王牌面',()=>{
 const g=setup(3),i=g.turn,j=(i+1)%3,joker=giveTurnPlayerJoker(g);playCards(g,ids[i],[joker.id],'3');assert.ok(publicState(g,ids[j]).pile.every(p=>!('card' in p)));challenge(g,ids[j]);assert.ok(publicState(g,ids[j]).pile.every(p=>!('card' in p)));resolveAccuse(g);assert.equal(publicState(g,ids[j]).pile[0].card.rank,joker.rank);
});
