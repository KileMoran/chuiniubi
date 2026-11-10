// 吹牛逼 · server-authoritative game logic. Never import this file in the browser.
export const RANKS = ['2','A','K','Q','J','10','9','8','7','6','5','4','3'];
export const JOKER_RANKS = ['大王','小王'];
export const MAX_PLAY_CARDS = 12;
export const isJoker = card => !!card && JOKER_RANKS.includes(card.rank);
export const ROOM_OFFLINE_TTL_MS=2*60*60*1000; // Two hours after the final player disconnects.
export function roomOfflineDeadline(g){return Number.isFinite(g?.offlineSince)?g.offlineSince+ROOM_OFFLINE_TTL_MS:null;}
export function isRoomExpired(g,now=Date.now()){const deadline=roomOfflineDeadline(g);return deadline!==null&&now>=deadline;}
const SUITS=['♠','♥','♣','♦'];
// 1–2 玩家：普通一副（52张）；3–6 玩家：两副含大小王（108张，2大王+2小王）。
export function deckCountForCapacity(capacity){return capacity<=2?1:2;}
export function expectedCardCount(capacity){return capacity<=2?52:108;}
export function err(condition,message){if(!condition)throw new Error(message);}
export function freshGame(room='',capacity=5){return {
 room,capacity,offlineSince:null,lastSeenAt:Date.now(),players:[],host:null,phase:'lobby',phaseUntil:0,round:0,rank:null,turn:null,
 last:null,pile:[],discard:[],passes:0,moveId:0,cardSlot:0,winner:null,result:null,
 starter:null,eventId:0,event:{type:'lobby',text:'等待玩家加入'},stats:{caught:0,failed:0}
};}
const randomInt=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n;
export function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function sortCards(a){const ranks=[...JOKER_RANKS,...RANKS];return a.sort((x,y)=>ranks.indexOf(x.rank)-ranks.indexOf(y.rank)||SUITS.indexOf(x.suit)-SUITS.indexOf(y.suit));}
export function addPlayer(g,id,name){err(g.phase==='lobby','对局已开始，无法加入新玩家');err(g.players.length<g.capacity,'房间已经满员');err(!g.players.some(p=>p.id===id),'玩家已在房间');
 const player={id,name:name.slice(0,12),seat:g.players.length,hand:[]};g.players.push(player);if(!g.host)g.host=id;
 event(g,'join',{player:player.seat,text:`${player.name} 加入了房间`});return player;
}
export const playerIndex=(g,id)=>g.players.findIndex(p=>p.id===id);
export function event(g,type,extra={}){g.eventId++;g.event={id:g.eventId,type,...extra};}
export function startGame(g,actor,onlineIds){
 err(g.phase==='lobby'||g.phase==='finished','当前无法开始');err(g.host===actor,'只有房主能开始');
 err(g.players.length===g.capacity,'需要先凑齐房间人数');
 err(g.players.every(p=>onlineIds.includes(p.id)),'有玩家掉线，请等待重连');
 const deck=[];let id=0;for(let d=0;d<deckCountForCapacity(g.capacity);d++){for(const r of RANKS)for(const s of SUITS)deck.push({id:`c${id++}`,rank:r,suit:s});if(g.capacity>=3)for(const rank of JOKER_RANKS)deck.push({id:`c${id++}`,rank,suit:'🃏'});}shuffle(deck);
 g.players.forEach(p=>p.hand=[]);deck.forEach((c,i)=>g.players[i%g.players.length].hand.push(c));g.players.forEach(p=>sortCards(p.hand));
 g.phase='choosing';g.phaseUntil=Date.now()+2500;g.round=1;g.rank=null;g.pile=[];g.discard=[];g.last=null;g.passes=0;g.turn=null;g.moveId=0;g.cardSlot=0;g.winner=null;g.result=null;g.stats={caught:0,failed:0};
 g.starter=randomInt(g.players.length);event(g,'draw',{player:g.starter,text:'系统正在随机抽取先手'});
}
export function nextTurn(g,i){return (i+1)%g.players.length;}
export function beginTurn(g){g.phase='playing';g.phaseUntil=0;g.turn=g.starter;event(g,'turn',{player:g.turn,text:`${g.players[g.turn].name} 先出牌`});}
export function playCards(g,id,ids,rank){
 const i=playerIndex(g,id);err(g.phase==='playing'&&g.turn===i,'还没轮到你出牌');err(Array.isArray(ids)&&ids.length>=1&&ids.length<=MAX_PLAY_CARDS,'每次只能出1–12张牌');
 err(ids.every(x=>typeof x==='string')&&new Set(ids).size===ids.length,'选牌有误');
 const claim=g.rank||rank;err(RANKS.includes(claim),'请选择正确点数');err(!g.rank||rank===g.rank,'本轮只能宣称同一点数');
 const current=g.players[i];const cards=ids.map(k=>current.hand.find(c=>c.id===k));err(cards.every(Boolean),'不能打出不存在的手牌');
 const keep=new Set(ids);current.hand=current.hand.filter(c=>!keep.has(c.id));g.rank=claim;g.passes=0;g.turn=null;
 const moveId=++g.moveId;for(const card of cards)g.pile.push({slot:++g.cardSlot,owner:i,moveId,card});
 g.last={player:i,rank:claim,count:cards.length,moveId};g.phase='cooldown';g.phaseUntil=Date.now()+2000;
 event(g,'play',{player:i,count:cards.length,rank:claim,moveId,text:`${current.name} 出了${cards.length}张${claim}`});
}
export function passTurn(g,id){
 const i=playerIndex(g,id);err(g.phase==='playing'&&g.turn===i,'现在不能不出牌');err(g.last,'本轮第一手必须出牌');
 g.passes++;if(g.passes>=g.players.length-1){g.phase='discarding';g.phaseUntil=Date.now()+650;g.turn=null;event(g,'discarding',{count:g.pile.length,text:'所有其他玩家不出牌，本轮暗牌弃置'});}
 else{g.turn=nextTurn(g,i);event(g,'pass',{player:i,text:`${g.players[i].name} 不出牌`});}
}
export function challenge(g,id){
 const i=playerIndex(g,id);err(i>=0,'无效玩家');
 err(['cooldown','playing'].includes(g.phase)&&g.last,'当前不能质疑');err(i!==g.last.player,'不能质疑自己');
 g.phase='accusing';g.phaseUntil=Date.now()+1500;g.turn=null;
 g.result={challenger:i,bluffer:g.last.player,receiver:null,starter:null,lied:null,won:null};
 event(g,'accuse',{player:i,text:`${g.players[i].name}：假的！！！`});
}
export function resolveAccuse(g){
 err(g.phase==='accusing','状态错误');const move=g.last;
 const lied=g.pile.some(p=>p.moveId===move.moveId&&!isJoker(p.card)&&p.card.rank!==move.rank);
 const challenger=g.result.challenger;const receiver=lied?move.player:challenger;const starter=lied?challenger:move.player;
 g.result={...g.result,lied,receiver,starter,won:(!lied&&g.players[move.player].hand.length===0)?move.player:null};
 if(lied)g.stats.caught++;else g.stats.failed++;
 // First stage: the challenged last play is revealed, while older pile cards remain secret.
 g.phase='reveal_last';g.phaseUntil=Date.now()+2900;
 event(g,'reveal_last',{player:challenger,text:lied?'抓到假牌！':'质疑失败！',lied,receiver});
}
export function revealRemaining(g){
 err(g.phase==='reveal_last','状态错误');
 // Players inspect real cards on the tabletop. Large 4-deck piles may need several
 // pages on a phone; grant enough time without creating an indefinite game pause.
 // V7.7.4: halve the full-table reveal wait; first-stage and collection timers stay unchanged.
  const duration=Math.max(4500,Math.min(22500,3250+Math.ceil(g.pile.length/18)*1400));
 g.phase='reveal';g.phaseUntil=Date.now()+duration;
 event(g,'reveal_all',{count:g.pile.length,text:`公开本轮全部${g.pile.length}张暗牌`});
}
export function startCollect(g){err(g.phase==='reveal','状态错误');g.phase='collecting';g.phaseUntil=Date.now()+700;event(g,'collecting',{receiver:g.result.receiver,count:g.pile.length,text:`收走本轮${g.pile.length}张牌`});}
export function completeCollect(g){
 err(g.phase==='collecting','状态错误');const {receiver,starter,won}=g.result;
 g.players[receiver].hand.push(...g.pile.map(p=>p.card));sortCards(g.players[receiver].hand);g.pile=[];
 if(won!==null){g.winner=won;g.turn=null;g.phase='finished';g.phaseUntil=0;event(g,'win',{player:won,text:`${g.players[won].name} 获胜！`});return;}
 newRound(g,starter);
}
export function finishCooldown(g){
 err(g.phase==='cooldown','状态错误');const last=g.last;
 if(g.players[last.player].hand.length===0){g.winner=last.player;g.phase='finished';g.phaseUntil=0;g.turn=null;event(g,'win',{player:g.winner,text:`${g.players[g.winner].name} 获胜！`});return;}
 // 单人练习没有其他玩家可以跟牌/质疑：每手结束后自动弃置暗牌并开启新回合。
 if(g.players.length===1){g.discard.push(...g.pile.map(p=>p.card));g.pile=[];newRound(g,last.player);return;}
 g.phase='playing';g.phaseUntil=0;g.turn=nextTurn(g,last.player);event(g,'turn',{player:g.turn,text:`轮到${g.players[g.turn].name}`});
}
export function finishDiscard(g){err(g.phase==='discarding','状态错误');const nextStarter=g.last.player;
 g.discard.push(...g.pile.map(p=>p.card));g.pile=[];newRound(g,nextStarter);}
export function newRound(g,starter){g.phase='playing';g.phaseUntil=0;g.turn=starter;g.rank=null;g.last=null;g.passes=0;g.result=null;g.round++;event(g,'round',{player:starter,text:`第${g.round}轮，${g.players[starter].name}先出牌`});}
export function tick(g){
 if(!g.phaseUntil||Date.now()<g.phaseUntil)return false;
 switch(g.phase){case 'choosing':beginTurn(g);return true;case 'cooldown':finishCooldown(g);return true;case 'accusing':resolveAccuse(g);return true;case 'reveal_last':revealRemaining(g);return true;case 'reveal':startCollect(g);return true;case 'collecting':completeCollect(g);return true;case 'discarding':finishDiscard(g);return true;default:return false;}
}
export function totalCards(g){return g.players.reduce((n,p)=>n+p.hand.length,0)+g.pile.length+g.discard.length;}
export function publicState(g,id,onlineIds=[]){
 const revealAll=['reveal','collecting'].includes(g.phase);
 const revealLast=g.phase==='reveal_last';const index=playerIndex(g,id);
 return {room:g.room,capacity:g.capacity,host:playerIndex(g,g.host),me:index,players:g.players.map(p=>({id:`seat-${p.seat}`,name:p.name,seat:p.seat,count:p.hand.length,online:onlineIds.includes(p.id),host:p.id===g.host})),
 phase:g.phase,phaseUntil:g.phaseUntil,serverNow:Date.now(),round:g.round,rank:g.rank,deckCount:deckCountForCapacity(g.capacity),turn:g.turn,starter:g.phase==='choosing'?null:g.starter,
 last:g.last?{...g.last}:null,passes:g.passes,discardCount:g.discard.length,
 pile:g.pile.map(p=>({slot:p.slot,owner:p.owner,moveId:p.moveId,...((revealAll||(revealLast&&p.moveId===g.last?.moveId))?{card:p.card}: {})})),
 hand:index>=0?g.players[index].hand:[],winner:g.winner,result:(revealAll||revealLast)?g.result:null,
 event:g.event,stats:g.stats,onlineCount:onlineIds.length};
}
