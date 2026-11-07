import {DurableObject} from 'cloudflare:workers';
import {freshGame,addPlayer,playerIndex,startGame,playCards,passTurn,challenge,tick,publicState,totalCards,expectedCardCount,event,roomOfflineDeadline,isRoomExpired} from './game.js';

const isToken=s=>/^[a-f0-9-]{36}$/i.test(s||'');
const isRoom=s=>/^[A-Z0-9]{6}$/.test(s||'');
const voiceConfigured=env=>['CF_RTK_ACCOUNT_ID','CF_RTK_APP_ID','CF_RTK_API_TOKEN','CF_RTK_PRESET'].every(k=>typeof env[k]==='string'&&env[k].length>0);
async function realtimeApi(env,uri,method='POST',body){
 const base=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_RTK_ACCOUNT_ID)}/realtime/kit/${encodeURIComponent(env.CF_RTK_APP_ID)}`;
 const r=await fetch(base+uri,{method,headers:{Authorization:`Bearer ${env.CF_RTK_API_TOKEN}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const payload=await r.json().catch(()=>null);
 if(!r.ok||payload?.success!==true||(method!=='DELETE'&&!payload?.data))throw Error('RealtimeKit API 请求失败 (HTTP '+r.status+')');
 return payload.data;
}

export default {
 async fetch(request,env){const url=new URL(request.url);
  if(url.pathname==='/health')return Response.json({ok:true,service:'吹牛逼·联机服务器',version:'1.1-voice',gameplay:'v7.7.3',roomIdlePolicy:'2h-offline'});
  if(url.pathname!=='/ws')return new Response('Use /health or /ws',{status:404});
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const room=url.searchParams.get('room')?.toUpperCase();
  if(!isRoom(room)||!isToken(url.searchParams.get('token')))return new Response('Bad room or player token',{status:400});
  return env.ROOMS.getByName(room).fetch(request);
 }
};
export class GameRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.voiceQueue=Promise.resolve();this.ctx.blockConcurrencyWhile(async()=>{this.g=await ctx.storage.get('game')||null;this.voiceMeta=await ctx.storage.get('voiceMeta')||{meetingId:null,participants:{}};});}
 onlineIds(){return [...new Set(this.ctx.getWebSockets().filter(s=>s.readyState===1).map(s=>s.deserializeAttachment()?.id).filter(Boolean))];}
 send(ws,obj){if(ws.readyState===1)ws.send(JSON.stringify(obj));}
 broadcast(){const online=this.onlineIds();for(const ws of this.ctx.getWebSockets()){const id=ws.deserializeAttachment()?.id;if(id){const state=publicState(this.g,id,online);state.players=state.players.map((p,i)=>({...p,voiceKey:this.voiceMeta.participants[this.g.players[i].id]?.voiceKey||null}));this.send(ws,{type:'state',state});}}}
 async save(){
  if(!this.g)return;
  await this.ctx.storage.put('game',this.g);
  const next=[this.g.phaseUntil,roomOfflineDeadline(this.g)].filter(v=>Number.isFinite(v)&&v>0);
  if(next.length)await this.ctx.storage.setAlarm(Math.min(...next));
  else await this.ctx.storage.deleteAlarm();
 }
 // Clean persisted room/voice data once everybody has been disconnected for two hours.
 async expireRoom(){
  const meetingId=this.voiceMeta?.meetingId;
  if(meetingId&&voiceConfigured(this.env))this.ctx.waitUntil(realtimeApi(this.env,`/meetings/${meetingId}`,'PATCH',{status:'INACTIVE'}).catch(e=>console.warn('Meeting cleanup failed',String(e))));
  this.g=null;this.voiceMeta={meetingId:null,participants:{}};
  await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();
 }
 // Respond *through* the existing /ws relay so browsers can distinguish an expired room
 // from a temporary outage (HTTP 410 cannot be inspected by the WebSocket API).
 rejectMissingRoom(){
  const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);
  this.send(server,{type:'room_expired',message:'房间不存在或已自动关闭，请返回主菜单重新创建或加入'});
  server.close(4001,'房间已关闭');
  return new Response(null,{status:101,webSocket:client});
 }
 // Handle unexpected disconnects/migrations: lastSeenAt is a conservative fallback
 // if a prior version left no persisted offlineSince timestamp.
 async reconcileOffline(now=Date.now()){
  if(!this.g||this.onlineIds().length)return false;
  if(!Number.isFinite(this.g.offlineSince)){
   const last=Number.isFinite(this.g.lastSeenAt)?this.g.lastSeenAt:0;
   this.g.offlineSince=last;
  }
  if(isRoomExpired(this.g,now)){await this.expireRoom();return true;}
  await this.save();return false;
 }
 async onDisconnected(ws){
  if(!this.g)return;
  const hasOthers=this.ctx.getWebSockets().some(s=>s!==ws&&s.readyState===1&&s.deserializeAttachment()?.id);
  if(!hasOthers){
   if(!Number.isFinite(this.g.offlineSince))this.g.offlineSince=Date.now();
   this.g.lastSeenAt=Date.now();await this.save();
  }
  this.broadcast();
 }
 async getVoiceTicket(playerId){
  if(!voiceConfigured(this.env))throw Error('语音服务尚未配置：请先设置 Cloudflare Worker 的四项环境变量');
  if(!this.g.players.some(p=>p.id===playerId))throw Error('玩家不在游戏房间');
  if(!this.voiceMeta.meetingId){
   const meeting=await realtimeApi(this.env,'/meetings','POST',{title:'吹牛逼 · '+this.g.room,session_keep_alive_time_in_secs:60});
   this.voiceMeta.meetingId=meeting.id;await this.ctx.storage.put('voiceMeta',this.voiceMeta);
  }
  let record=this.voiceMeta.participants[playerId];
  if(record?.token&&new Date(record.expiresOn||0).getTime()>Date.now()+120000)return record.token;
  const expiresOn=new Date(Date.now()+8*3600*1000).toISOString();
  if(record?.participantId){
   const refreshed=await realtimeApi(this.env,`/meetings/${this.voiceMeta.meetingId}/participants/${record.participantId}/token`,'POST',{expires_on:expiresOn});
   record.token=refreshed.token;record.expiresOn=refreshed.expires_on||expiresOn;
  }else{
   const player=this.g.players.find(p=>p.id===playerId);
   const voiceKey=crypto.randomUUID();
   const added=await realtimeApi(this.env,`/meetings/${this.voiceMeta.meetingId}/participants`,'POST',{
    custom_participant_id:voiceKey,name:player.name,preset_name:this.env.CF_RTK_PRESET,token:{expires_on:expiresOn}
   });
   record={participantId:added.id,voiceKey,token:added.token,expiresOn:added.expires_on||expiresOn};
   this.voiceMeta.participants[playerId]=record;
  }
  await this.ctx.storage.put('voiceMeta',this.voiceMeta);
  return record.token;
 }
 async revokeVoice(playerId){
  const meta=this.voiceMeta.participants[playerId];if(!meta)return;
  delete this.voiceMeta.participants[playerId];await this.ctx.storage.put('voiceMeta',this.voiceMeta);
  if(voiceConfigured(this.env)&&this.voiceMeta.meetingId){
   const uri=`/meetings/${this.voiceMeta.meetingId}/participants/${meta.participantId}`;
   try{await realtimeApi(this.env,uri,'DELETE')}catch(err){console.warn('Unable to revoke voice participant',String(err));}
  }
 }
 async fetch(request){
  const url=new URL(request.url);const room=url.searchParams.get('room')?.toUpperCase();const token=url.searchParams.get('token');const rawName=url.searchParams.get('name')||'玩家';
  const name=[...rawName.replace(/[\u0000-\u001f\u007f<>]/g,'').trim()].slice(0,12).join('')||'玩家';
  const create=url.searchParams.get('create')==='1';const capacity=Number(url.searchParams.get('capacity')||'5');
  // Expired rooms are cleaned before admitting a reconnect; new players must create anew.
  if(this.g&&await this.reconcileOffline()&&!create)return this.rejectMissingRoom();
  if(!this.g){if(!create)return this.rejectMissingRoom();if(!Number.isInteger(capacity)||capacity<1||capacity>6)return new Response('人数需为1至6',{status:400});this.g=freshGame(room,capacity);}
  if(this.g.room!==room)return new Response('房间不匹配',{status:400});
  let player=this.g.players.find(p=>p.id===token);if(!player){try{player=addPlayer(this.g,token,name);}catch(e){return new Response(e.message,{status:409});}}
  for(const old of this.ctx.getWebSockets())if(old.deserializeAttachment()?.id===player.id)try{old.close(1000,'同一身份在新窗口加入');}catch{}
  const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);server.serializeAttachment({id:player.id});
  this.g.offlineSince=null;this.g.lastSeenAt=Date.now();
  await this.save();this.send(server,{type:'hello',id:player.id});this.broadcast();return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,raw){
  const id=ws.deserializeAttachment()?.id;if(!this.g||playerIndex(this.g,id)<0)return this.send(ws,{type:'error',message:'玩家身份无效'});
  if(typeof raw!=='string'||raw.length>2048)return this.send(ws,{type:'error',message:'消息过长'});
  let data;try{data=JSON.parse(raw);}catch{return this.send(ws,{type:'error',message:'消息格式错误'});}
  try{
   switch(data.type){
    case 'voice_ticket':{
     this.voiceQueue=this.voiceQueue.catch(()=>{}).then(()=>this.getVoiceTicket(id));
     try{const ticket=await this.voiceQueue;this.send(ws,{type:'voice_ticket',token:ticket});this.broadcast();}
     catch(e){console.warn('Voice ticket error',String(e));this.send(ws,{type:'voice_unavailable',message:voiceConfigured(this.env)?'语音房间创建失败，请检查 Voice 预设、API Token 权限和 Worker 日志':'语音服务尚未配置，请先在 Cloudflare 添加 RealtimeKit 设置'});}
     return;
    }
    case 'start':startGame(this.g,id,this.onlineIds());break;
    case 'play':playCards(this.g,id,data.ids,data.rank);break;
    case 'pass':passTurn(this.g,id);break;
    case 'challenge':challenge(this.g,id);break;
    case 'leave':{
     if(this.g.phase!=='lobby'&&this.g.phase!=='finished')throw new Error('对局进行中请直接关闭网页，重新加入可恢复手牌');
     await this.voiceQueue.catch(()=>{});await this.revokeVoice(id);
     this.g.players=this.g.players.filter(p=>p.id!==id);this.g.players.forEach((p,i)=>p.seat=i);
     if(this.g.host===id)this.g.host=this.g.players[0]?.id||null;
     if(!this.g.players.length){
      if(this.voiceMeta.meetingId&&voiceConfigured(this.env)){
       const oldMeeting=this.voiceMeta.meetingId;
       this.ctx.waitUntil(realtimeApi(this.env,`/meetings/${oldMeeting}`,'PATCH',{status:'INACTIVE'}).catch(()=>{}));
      }
      this.voiceMeta={meetingId:null,participants:{}};await this.ctx.storage.put('voiceMeta',this.voiceMeta);
      this.g=freshGame(this.g.room,this.g.capacity);
     }else{this.g.phase='lobby';event(this.g,'leave',{text:'有玩家离开房间'});}
     await this.save();this.broadcast();ws.close(1000,'已离开房间');return;
    }
    default:throw new Error('未知操作');
   }
   if(this.g.phase!=='lobby'&&this.g.phase!=='finished'&&totalCards(this.g)!==expectedCardCount(this.g.capacity))throw new Error('牌数校验失败');
   await this.save();this.broadcast();
  }catch(e){this.send(ws,{type:'error',message:e.message||'操作失败'});}
 }
 async alarm(){
  if(!this.g)return;
  if(await this.reconcileOffline())return;
  if(tick(this.g))this.broadcast();
  await this.save();
 }
 async webSocketClose(ws){await this.onDisconnected(ws);}
 async webSocketError(ws){await this.onDisconnected(ws);}
}
