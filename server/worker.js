import {DurableObject} from 'cloudflare:workers';
import {freshGame,addPlayer,playerIndex,startGame,playCards,passTurn,challenge,tick,publicState,totalCards,event} from './game.js';

const isToken=s=>/^[a-f0-9-]{36}$/i.test(s||'');
const isRoom=s=>/^[A-Z0-9]{6}$/.test(s||'');
export default {
 async fetch(request,env){const url=new URL(request.url);
  if(url.pathname==='/health')return Response.json({ok:true,service:'吹牛逼·联机服务器',version:'1.0'});
  if(url.pathname!=='/ws')return new Response('Use /health or /ws',{status:404});
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const room=url.searchParams.get('room')?.toUpperCase();
  if(!isRoom(room)||!isToken(url.searchParams.get('token')))return new Response('Bad room or player token',{status:400});
  return env.ROOMS.getByName(room).fetch(request);
 }
};
export class GameRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.ctx.blockConcurrencyWhile(async()=>{this.g=await ctx.storage.get('game')||null;});}
 onlineIds(){return [...new Set(this.ctx.getWebSockets().filter(s=>s.readyState===1).map(s=>s.deserializeAttachment()?.id).filter(Boolean))];}
 send(ws,obj){if(ws.readyState===1)ws.send(JSON.stringify(obj));}
 broadcast(){const online=this.onlineIds();for(const ws of this.ctx.getWebSockets()){const id=ws.deserializeAttachment()?.id;if(id)this.send(ws,{type:'state',state:publicState(this.g,id,online)});}}
 async save(){if(this.g){await this.ctx.storage.put('game',this.g);if(this.g.phaseUntil)await this.ctx.storage.setAlarm(this.g.phaseUntil);else await this.ctx.storage.deleteAlarm();}}
 async fetch(request){
  const url=new URL(request.url);const room=url.searchParams.get('room')?.toUpperCase();const token=url.searchParams.get('token');const rawName=url.searchParams.get('name')||'玩家';
  const name=[...rawName.replace(/[\u0000-\u001f\u007f<>]/g,'').trim()].slice(0,12).join('')||'玩家';
  const create=url.searchParams.get('create')==='1';const capacity=Number(url.searchParams.get('capacity')||'5');
  if(!this.g){if(!create)return new Response('该房间不存在，请先创建房间',{status:404});if(!Number.isInteger(capacity)||capacity<4||capacity>6)return new Response('人数需为4至6',{status:400});this.g=freshGame(room,capacity);}
  if(this.g.room!==room)return new Response('房间不匹配',{status:400});
  let player=this.g.players.find(p=>p.id===token);if(!player){try{player=addPlayer(this.g,token,name);}catch(e){return new Response(e.message,{status:409});}}
  for(const old of this.ctx.getWebSockets())if(old.deserializeAttachment()?.id===player.id)try{old.close(1000,'同一身份在新窗口加入');}catch{}
  const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);server.serializeAttachment({id:player.id});
  await this.save();this.send(server,{type:'hello',id:player.id});this.broadcast();return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,raw){
  const id=ws.deserializeAttachment()?.id;if(!this.g||playerIndex(this.g,id)<0)return this.send(ws,{type:'error',message:'玩家身份无效'});
  if(typeof raw!=='string'||raw.length>2048)return this.send(ws,{type:'error',message:'消息过长'});
  let data;try{data=JSON.parse(raw);}catch{return this.send(ws,{type:'error',message:'消息格式错误'});}
  try{
   switch(data.type){
    case 'start':startGame(this.g,id,this.onlineIds());break;
    case 'play':playCards(this.g,id,data.ids,data.rank);break;
    case 'pass':passTurn(this.g,id);break;
    case 'challenge':challenge(this.g,id);break;
    case 'leave':{
     if(this.g.phase!=='lobby'&&this.g.phase!=='finished')throw new Error('对局进行中请直接关闭网页，重新加入可恢复手牌');
     this.g.players=this.g.players.filter(p=>p.id!==id);this.g.players.forEach((p,i)=>p.seat=i);
     if(this.g.host===id)this.g.host=this.g.players[0]?.id||null;
     if(!this.g.players.length){this.g=freshGame(this.g.room,this.g.capacity);}else{this.g.phase='lobby';event(this.g,'leave',{text:'有玩家离开房间'});}
     await this.save();this.broadcast();ws.close(1000,'已离开房间');return;
    }
    default:throw new Error('未知操作');
   }
   if(this.g.phase!=='lobby'&&this.g.phase!=='finished'&&totalCards(this.g)!==104)throw new Error('牌数校验失败');
   await this.save();this.broadcast();
  }catch(e){this.send(ws,{type:'error',message:e.message||'操作失败'});}
 }
 async alarm(){if(!this.g)return;
  if(tick(this.g)){await this.save();this.broadcast();}else if(this.g.phaseUntil){await this.ctx.storage.setAlarm(this.g.phaseUntil);}
 }
 async webSocketClose(ws){this.broadcast();}
 async webSocketError(ws){this.broadcast();}
}
