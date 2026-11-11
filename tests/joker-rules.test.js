import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshGame, addPlayer, startGame, beginTurn, playCards, challenge,
  resolveAccuse, publicState, totalCards, expectedCardCount, isJoker,
  MAX_PLAY_CARDS, RANDOM_EVENT_TYPES
} from '../server/game.js';

const ids = Array.from({ length: 6 }, (_, i) =>
  `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
);
function setup(n) {
  const g = freshGame('JKR888', n);
  for (let i = 0; i < n; i++) addPlayer(g, ids[i], `玩家${i + 1}`);
  startGame(g, ids[0], ids.slice(0, n));
  beginTurn(g);
  // 这份文件只测大小王；彩蛋随机性在 random-events.test.js 单独测试。
  g.randomEventUsed = Object.fromEntries(RANDOM_EVENT_TYPES.map(type => [type, true]));
  return g;
}
function giveTurnPlayerJoker(g) {
  const turn = g.turn;
  const owned = g.players[turn].hand.find(isJoker);
  if (owned) return owned;
  const from = g.players.findIndex(p => p.hand.some(isJoker));
  assert.ok(from >= 0);
  const index = g.players[from].hand.findIndex(isJoker);
  const [joker] = g.players[from].hand.splice(index, 1);
  g.players[turn].hand.push(joker);
  return joker;
}

test('1–2人54张含1大王1小王；3–6人108张含2大王2小王', () => {
  for (let n = 1; n <= 6; n++) {
    const g = setup(n), all = g.players.flatMap(p => p.hand);
    const total = n <= 2 ? 54 : 108;
    assert.equal(all.length, total);
    assert.equal(expectedCardCount(n), total);
    assert.equal(all.filter(c => c.rank === '大王').length, n <= 2 ? 1 : 2);
    assert.equal(all.filter(c => c.rank === '小王').length, n <= 2 ? 1 : 2);
    assert.equal(new Set(all.map(c => c.id)).size, all.length);
    assert.equal(publicState(g, ids[0]).deckCount, n <= 2 ? 1 : 2);
    const count = g.players.map(p => p.hand.length);
    assert.ok(Math.max(...count) - Math.min(...count) <= 1);
  }
});

test('单次最多12张：允许12，拒绝13，并保持总牌数不变', () => {
  const g = setup(4), i = g.turn;
  const thirteen = g.players[i].hand.slice(0, 13).map(c => c.id);
  assert.equal(MAX_PLAY_CARDS, 12);
  assert.throws(() => playCards(g, ids[i], thirteen, '7'), /1–12/);
  assert.equal(totalCards(g), 108);
  playCards(g, ids[i], thirteen.slice(0, 12), '7');
  assert.equal(g.last.count, 12);
  assert.equal(g.pile.length, 12);
  assert.equal(totalCards(g), 108);
});

test('单张大小王可代表任意宣称点数，质疑时算真牌', () => {
  const g = setup(3), i = g.turn, j = (i + 1) % 3;
  const joker = giveTurnPlayerJoker(g);
  assert.ok(isJoker(joker));
  playCards(g, ids[i], [joker.id], 'K');
  challenge(g, ids[j]);
  resolveAccuse(g);
  assert.equal(g.result.lied, false);
  assert.equal(g.result.receiver, j);
  assert.equal(totalCards(g), 108);
  assert.equal(publicState(g, ids[0]).pile[0].card.rank, joker.rank);
});

test('大小王 + 同点数普通牌算真牌', () => {
  const g = setup(4), i = g.turn, j = (i + 1) % 4;
  const joker = giveTurnPlayerJoker(g);
  const natural = g.players[i].hand.find(c => !isJoker(c));
  assert.ok(natural);
  playCards(g, ids[i], [joker.id, natural.id], natural.rank);
  challenge(g, ids[j]);
  resolveAccuse(g);
  assert.equal(g.result.lied, false);
  assert.equal(totalCards(g), 108);
});

test('大小王不能掩盖同一手中普通牌的假报', () => {
  const g = setup(5), i = g.turn, j = (i + 1) % 5;
  const joker = giveTurnPlayerJoker(g);
  const normal = g.players[i].hand.find(c => !isJoker(c));
  assert.ok(normal);
  const fake = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'].find(r => r !== normal.rank);
  playCards(g, ids[i], [joker.id, normal.id], fake);
  challenge(g, ids[j]);
  resolveAccuse(g);
  assert.equal(g.result.lied, true);
  assert.equal(g.result.receiver, i);
  assert.equal(totalCards(g), 108);
});

test('翻牌前不能向其他玩家提前公开大小王', () => {
  const g = setup(3), i = g.turn, j = (i + 1) % 3;
  const joker = giveTurnPlayerJoker(g);
  playCards(g, ids[i], [joker.id], '3');
  assert.ok(publicState(g, ids[j]).pile.every(p => !('card' in p)));
  challenge(g, ids[j]);
  assert.ok(publicState(g, ids[j]).pile.every(p => !('card' in p)));
  resolveAccuse(g);
  assert.equal(publicState(g, ids[j]).pile[0].card.rank, joker.rank);
});
