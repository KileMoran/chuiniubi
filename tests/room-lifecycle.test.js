import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as game from '../server/game.js';

const TTL=game.ROOM_OFFLINE_TTL_MS;
const TOKEN='00000000-0000-4000-8000-000000000001';
const TOKEN2='00000000-0000-4000-8000-000000000002';

function fixture(){
 const storage={data:new Map(),alarm:null,async put(k,v){this.data.set(k,structuredClone(v))},async get(k){return structuredClone(this.data.get(k))},async setAlarm(t){this.alarm=t},async deleteAlarm(){this.alarm=null},async deleteAll(){this.data.clear()}};
 const ctx={storage,sockets:[],blockConcurrencyWhile(fn){this.ready=Promise.resolve(fn())},getWebSockets(){return this.sockets},acceptWebSocket(s){this.sockets.push(s)},waitUntil(p){this.lastWait=p}};
 class WS {constructor(){this.readyState=1;this.messages=[];this.tag=null;}serializeAttachment(d){this.tag=d}deserializeAttachment(){return this.tag}send(msg){this.messages.push(JSON.parse(msg))}close(code,reason){this.readyState=3;this.closeCode=code;this.closeReason=reason}}
 class WSResponse{constructor(body,init={}){this.body=body;Object.assign(this,init)}static json(payload){return {payload,status:200}}}
 const source=readFileSync(new URL('../server/worker.js',import.meta.url),'utf8')
  .replace(/^import .*?;\s*$/gm,'')
  .replace('export default {','const workerDefault = {')
  .replace('export class GameRoom','class GameRoom');
 const scope={...game,DurableObject:class{constructor(c,e){this.ctx=c;this.env=e}},WebSocketPair:class{constructor(){return {client:new WS(),server:new WS()}}},Response:WSResponse,URL,URLSearchParams,Date,crypto,console,fetch:()=>{throw Error('No external API expected')}};
 const {GameRoom}=vm.runInNewContext(source+'\n;({GameRoom})',vm.createContext(scope));
 const room=new GameRoom(ctx,{});
 function request({create=false,token=TOKEN,name='玩家',cap=2}={}){
  return new Request('https://game.internal/ws?'+new URLSearchParams({room:'EXPIRE',token,name,capacity:String(cap),...(create?{create:'1'}:{})}));
 }
 return {room,ctx,storage,request};
}

test('到期边界严格为最后全员离线 2 小时',()=>{
 const g=game.freshGame('ROOM77',2);
 assert.equal(game.roomOfflineDeadline(g),null);
 g.offlineSince=100_000;
 assert.equal(game.roomOfflineDeadline(g),100_000+TTL);
 assert.equal(game.isRoomExpired(g,100_000+TTL-1),false);
 assert.equal(game.isRoomExpired(g,100_000+TTL),true);
});

test('最后一名断线时保留牌局、设定清理 Alarm；过期前恢复后取消',async()=>{
 const {room,ctx,storage,request}=fixture();await ctx.ready;
 const res=await room.fetch(request({create:true}));assert.equal(res.status,101);
 const ws=ctx.sockets[0]; assert.equal(room.g.players.length,1);
 ws.readyState=3;await room.webSocketClose(ws);
 assert.ok(Number.isFinite(room.g.offlineSince));
 assert.equal(storage.alarm,room.g.offlineSince+TTL);
 assert.equal(storage.data.get('game').players.length,1);
 const resumed=await room.fetch(request());assert.equal(resumed.status,101);
 assert.equal(room.g.offlineSince,null);assert.equal(room.g.players.length,1);
 assert.equal(storage.alarm,null);
});

test('两名玩家中只断开一名，不启动过期倒计时',async()=>{
 const {room,ctx,storage,request}=fixture();await ctx.ready;
 await room.fetch(request({create:true}));await room.fetch(request({token:TOKEN2,name:'玩家二'}));
 ctx.sockets[0].readyState=3;await room.webSocketClose(ctx.sockets[0]);
 assert.equal(room.g.offlineSince,null);assert.equal(storage.alarm,null);
 assert.equal(room.g.players.length,2);
});

test('离线满两小时后自动清理房间及 voiceMeta，并允许同房间号重新创建',async()=>{
 const {room,ctx,storage,request}=fixture();await ctx.ready;
 await room.fetch(request({create:true}));const ws=ctx.sockets[0];ws.readyState=3;await room.webSocketClose(ws);
 room.g.offlineSince=Date.now()-TTL-10;await room.save();await room.alarm();
 assert.equal(room.g,null);assert.equal(storage.data.size,0);assert.equal(storage.alarm,null);
 const fail=await room.fetch(request());assert.equal(fail.status,101);
 const rejected=ctx.sockets.at(-1);assert.equal(rejected.closeCode,4001);
 assert.equal(rejected.messages[0].type,'room_expired');
 assert.equal(room.g,null);
 const fresh=await room.fetch(request({create:true}));assert.equal(fresh.status,101);
 assert.equal(room.g.players.length,1);assert.equal(room.g.offlineSince,null);
});

test('离线过期但报警未及时触发，也会在下次进入前删除旧牌局',async()=>{
 const {room,ctx,request}=fixture();await ctx.ready;
 await room.fetch(request({create:true}));ctx.sockets[0].readyState=3;await room.webSocketClose(ctx.sockets[0]);
 room.g.offlineSince=Date.now()-TTL-1000;await room.save();
 const res=await room.fetch(request());assert.equal(res.status,101);
 assert.equal(ctx.sockets.at(-1).closeCode,4001);assert.equal(room.g,null);
});

test('旧版离线房间无生命周期时间戳时会清理，不沿用昨天旧状态',async()=>{
 const {room,ctx,storage,request}=fixture();await ctx.ready;
 const legacy=game.freshGame('EXPIRE',2);delete legacy.offlineSince;delete legacy.lastSeenAt;
 await storage.put('game',legacy);room.g=legacy;
 const r=await room.fetch(request());assert.equal(r.status,101);
 assert.equal(ctx.sockets.at(-1).closeCode,4001);
 assert.equal(storage.data.has('game'),false);
});
