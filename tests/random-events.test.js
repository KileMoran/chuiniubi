import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  freshGame,addPlayer,startGame,beginTurn,playCards,finishCooldown,finishDiscard,
  challenge,applyRandomEvent,maybeTriggerRandomEvent,totalCards,publicState,
  expectedCardCount,passTurn,MAX_PLAY_CARDS,RANDOM_EVENT_CHANCE
} from '../server/game.js';
const IDS=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
function setup(n=4){
 const g=freshGame('EVENT1',n);
 for(let i=0;i<n;i++)addPlayer(g,IDS[i],`玩家${i+1}`);
 startGame(g,IDS[0],IDS.slice(0,n));beginTurn(g);
 assert.equal(totalCards(g),expectedCardCount(n));
 // 测试中阻断概率触发，使用 applyRandomEvent 做完全确定性的验证。
 g.randomEventUsed={teacher:true,trashcan:true,faceup:true,phone:true};
 return g;
}
function playOne(g){const i=g.turn,card=g.players[i].hand[0];playCards(g,IDS[i],[card.id],g.rank||'K');return i;}
function allow(g,type){g.randomEventUsed[type]=false;}
test('单人模式 54 张大小王，永远不触发任何随机事件',()=>{
 const g=setup(1);playOne(g);for(const type of ['teacher','trashcan','faceup','phone']){
  assert.equal(applyRandomEvent(g,type),null);
 }assert.equal(maybeTriggerRandomEvent(g),null);assert.equal(g.randomEvent,null);assert.equal(totalCards(g),54);
});
test('双人模式也是54张，四人模式108张，原有上限仍是12',()=>{
 for(const n of [2,4,6]){const g=setup(n);assert.equal(totalCards(g),n<=2?54:108);assert.equal(g.players.flatMap(p=>p.hand).filter(c=>c.rank==='大王').length,n<=2?1:2);}
 assert.equal(MAX_PLAY_CARDS,12);assert.equal(RANDOM_EVENT_CHANCE,0.03);
});
for(const type of ['teacher','trashcan'])test(type+'：只选手牌>=10的玩家，牌进入弃牌堆且守恒，一局只生效一次',()=>{
 const g=setup(4),actor=playOne(g),target=(actor+1)%4;
 allow(g,type);const size=g.players[target].hand.length,before=g.discard.length;
 const result=applyRandomEvent(g,type,target);
 assert.equal(result?.player,target);assert.equal(g.players[target].hand.length,size-1);
 assert.equal(g.discard.length,before+1);assert.equal(totalCards(g),108);
 assert.equal(applyRandomEvent(g,type,target),null);assert.equal(totalCards(g),108);
});
test('低于10张不能丢牌，事件不消耗本局名额',()=>{
 const g=setup(2);playOne(g);
 allow(g,'teacher');
 for(const p of g.players){const extra=p.hand.splice(9);g.discard.push(...extra);}
 assert.equal(totalCards(g),54);
 assert.equal(applyRandomEvent(g,'teacher'),null);
 assert.equal(g.randomEventUsed.teacher,false);
});
test('意外翻牌：刚出牌的其中一张在质疑前对所有玩家公开，其余仍保密',()=>{
 const g=setup(4),i=g.turn,ids=g.players[i].hand.slice(0,3).map(c=>c.id);
 playCards(g,IDS[i],ids,'Q');allow(g,'faceup');
 const info=applyRandomEvent(g,'faceup');
 assert.equal(info?.type,'faceup');assert.equal(g.pile.filter(p=>p.peeked).length,1);
 for(let seat=0;seat<4;seat++){
  const s=publicState(g,IDS[seat]);assert.equal(s.pile.filter(p=>p.card).length,1);
  assert.equal(s.pile.find(p=>p.peeked).slot,info.slot);
 }
 assert.equal(totalCards(g),108);
});
test('手机：禁用质疑四个后续行动回合，轮到被禁用者自动跳过，随后正常恢复',()=>{
 const g=setup(2),actor=playOne(g),target=(actor+1)%2;
 allow(g,'phone');assert.equal(applyRandomEvent(g,'phone',target)?.type,'phone');
 assert.deepEqual(g.phoneBlock,{player:target,remaining:4});
 assert.throws(()=>challenge(g,IDS[target]),/回复重要消息/);
 finishCooldown(g); // 被禁用者第一个机会自动跳过 4=>3
 assert.equal(g.phase,'discarding');assert.equal(g.phoneBlock.remaining,3);
 finishDiscard(g); // actor 获得新一轮首出权
 assert.equal(g.turn,actor);
 playOne(g); // 第2次行动 3=>2
 assert.equal(g.phoneBlock.remaining,2);
 finishCooldown(g); // 第3次行动，被禁用者自动跳过 2=>1
 assert.equal(g.phase,'discarding');assert.equal(g.phoneBlock.remaining,1);
 finishDiscard(g);playOne(g); // 第4次行动 1=>0
 assert.equal(g.phoneBlock,null);
 finishCooldown(g);assert.equal(g.turn,target);
 assert.equal(g.phase,'playing');
 assert.doesNotThrow(()=>challenge(g,IDS[target]));
 assert.equal(totalCards(g),54);
});
test('手机：如果禁用目标是新回合首出玩家，首手不会卡住也不会非法不出',()=>{
 const g=setup(3),actor=playOne(g);allow(g,'phone');
 const next=(actor+1)%3;
 assert.equal(applyRandomEvent(g,'phone',actor)?.type,'phone');
 finishCooldown(g); // next 正常出牌
 assert.equal(g.turn,next);
 passTurn(g,IDS[next]); // 第1行动 4=>3
 const next2=(next+1)%3;
 assert.equal(g.turn,next2);
 passTurn(g,IDS[next2]); // 第2行动 3=>2，进入弃牌阶段
 assert.equal(g.phase,'discarding');
 finishDiscard(g); // actor 是上一出牌者，自动跳过作为首位出牌者 第3行动 2=>1
 assert.equal(g.turn,next);assert.equal(g.rank,null);assert.equal(g.phoneBlock.remaining,1);
 assert.equal(totalCards(g),108);
});
test('换新局会重置事件触发记录及手机限制',()=>{
 const g=setup(4);playOne(g);allow(g,'faceup');applyRandomEvent(g,'faceup');
 assert.equal(g.randomEventUsed.faceup,true);
 g.phase='finished';startGame(g,IDS[0],IDS.slice(0,4));
 assert.deepEqual(g.randomEventUsed,{});assert.equal(g.randomEvent,null);assert.equal(g.phoneBlock,null);
 assert.equal(totalCards(g),108);
});
