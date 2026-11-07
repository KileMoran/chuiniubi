import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,addPlayer,startGame,beginTurn,playCards,finishCooldown,challenge,resolveAccuse,revealRemaining,startCollect,completeCollect,publicState,totalCards,expectedCardCount,tick} from '../server/game.js';
const tokens=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
function setup(n=4){const g=freshGame('STAG77',n);for(let i=0;i<n;i++)addPlayer(g,tokens[i],`玩家${i}`);startGame(g,tokens[0],tokens.slice(0,n));beginTurn(g);return g;}
function view(g){return publicState(g,tokens[0],tokens.slice(0,g.players.length));}
test('质疑只公开上一手，再公开其他牌，且保留一局总牌数',()=>{
 const g=setup(4);const a=g.turn,hand=g.players[a].hand,rank='K';
 playCards(g,tokens[a],[hand[0].id,hand[1].id],rank);finishCooldown(g);
 const b=g.turn;playCards(g,tokens[b],[g.players[b].hand[0].id],rank);
 const lastMove=g.last.moveId;const previous=g.pile.filter(p=>p.moveId!==lastMove);
 assert.ok(previous.length>0);
 challenge(g,tokens[(b+1)%4]);assert.equal(g.phase,'accusing');
 assert.ok(view(g).pile.every(p=>!('card' in p)),'质疑喊话期间不能泄漏牌面');
 resolveAccuse(g);assert.equal(g.phase,'reveal_last');assert.equal(typeof g.result.lied,'boolean');
 const first=view(g);
 assert.equal(first.pile.filter(p=>p.card).length,1);
 assert.ok(first.pile.every(p=>p.moveId===lastMove?Boolean(p.card):!('card' in p)),'第一阶段只公开被质疑的上一手');
 revealRemaining(g);assert.equal(g.phase,'reveal');
 assert.ok(view(g).pile.every(p=>p.card),'第二阶段每一张牌都必须公开');
 assert.ok(g.phaseUntil-Date.now()>=6000,'揭牌展示留出查看时间');
 startCollect(g);assert.equal(g.phase,'collecting');
 assert.ok(view(g).pile.every(p=>p.card),'收牌动画仍能看清已翻出的牌');
 completeCollect(g);assert.equal(g.round,2);assert.equal(totalCards(g),expectedCardCount(4));
});
test('挑战方无法从第一阶段提前获得上一手以外的牌面',()=>{
 const g=setup(3);const a=g.turn;
 playCards(g,tokens[a],[g.players[a].hand[0].id],'A');finishCooldown(g);
 const b=g.turn;
 playCards(g,tokens[b],g.players[b].hand.slice(0,3).map(c=>c.id),'A');
 challenge(g,tokens[(b+1)%3]);resolveAccuse(g);
 const staged=view(g);
 assert.equal(staged.pile.filter(p=>p.card).length,3);
 assert.ok(staged.pile.every(p=>p.moveId===g.last.moveId?Boolean(p.card):!('card' in p)));
 assert.equal(totalCards(g),208);
 // Timed transition also includes the new first-stage phase.
 g.phaseUntil=Date.now()-1;assert.equal(tick(g),true);assert.equal(g.phase,'reveal');
 assert.equal(view(g).pile.filter(p=>p.card).length,4);
});
