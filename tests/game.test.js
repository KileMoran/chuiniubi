import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshGame, addPlayer, startGame, beginTurn, playCards, passTurn,
  challenge, resolveAccuse, revealRemaining, startCollect, completeCollect,
  finishCooldown, finishDiscard, totalCards, publicState, playerIndex,
  RANKS, isJoker, expectedCardCount, RANDOM_EVENT_TYPES,
  MAX_PLAY_CARDS
} from '../server/game.js';

// 这组测试只检查基础规则；随机事件专属测试放在 random-events.test.js。
// 禁止普通测试偶发触发 3% 彩蛋，避免随机失败。
const tokens = Array.from({ length: 6 }, (_, i) =>
  `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
);
function disableEasterEggs(g) {
  g.randomEventUsed = Object.fromEntries(RANDOM_EVENT_TYPES.map(type => [type, true]));
  return g;
}
function setup(n = 5) {
  const g = freshGame('ABC123', n);
  for (let i = 0; i < n; i++) addPlayer(g, tokens[i], `玩家${i + 1}`);
  startGame(g, tokens[0], tokens.slice(0, n));
  beginTurn(g);
  disableEasterEggs(g);
  assert.equal(totalCards(g), expectedCardCount(n));
  return g;
}
function firstMove(g, n = 3) {
  const i = g.turn;
  const ids = g.players[i].hand.slice(0, n).map(c => c.id);
  playCards(g, tokens[i], ids, g.rank || '3');
  return i;
}
function assertSecret(g) {
  for (let i = 0; i < g.players.length; i++) {
    const state = publicState(g, tokens[i], tokens.slice(0, g.players.length));
    assert.equal(state.hand.length, g.players[i].hand.length);
    for (let j = 0; j < g.players.length; j++) {
      if (j !== i) assert.ok(!JSON.stringify(state).includes(tokens[j]), '不能泄漏其他玩家凭证');
    }
    if (!['reveal', 'collecting', 'reveal_last'].includes(g.phase)) {
      assert.ok(state.pile.every(p => !('card' in p)), '不能提前泄漏暗牌');
    }
  }
}
function chooseNormal(g, seat) {
  const card = g.players[seat].hand.find(c => !isJoker(c));
  assert.ok(card, '本测试需要至少一张非大小王牌');
  return card;
}

test('1–6人发牌：1–2人54张，3–6人108张，每副都有大小王', () => {
  for (let n = 1; n <= 6; n++) {
    const g = setup(n);
    const all = g.players.flatMap(p => p.hand);
    const expected = n <= 2 ? 54 : 108;
    assert.equal(totalCards(g), expected);
    assert.equal(expectedCardCount(n), expected);
    assert.equal(all.filter(c => c.rank === '大王').length, n <= 2 ? 1 : 2);
    assert.equal(all.filter(c => c.rank === '小王').length, n <= 2 ? 1 : 2);
    assert.equal(new Set(all.map(c => c.id)).size, expected);
    assert.equal(publicState(g, tokens[0]).deckCount, n <= 2 ? 1 : 2);
    const sizes = g.players.map(p => p.hand.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, '发牌不均');
  }
});

test('4/5/6人发牌守恒，其他玩家无法看到暗牌', () => {
  for (const n of [4, 5, 6]) {
    const g = setup(n);
    firstMove(g);
    assertSecret(g);
    assert.equal(totalCards(g), 108);
  }
});

test('所有其他玩家不出后弃掉整轮暗牌，最后出牌者成为新首手', () => {
  const g = setup(5);
  const first = firstMove(g, 4);
  finishCooldown(g);
  for (let i = 0; i < 4; i++) {
    assert.equal(g.phase, 'playing');
    passTurn(g, tokens[g.turn]);
  }
  assert.equal(g.phase, 'discarding');
  assert.equal(g.pile.length, 4);
  finishDiscard(g);
  assert.equal(g.discard.length, 4);
  assert.equal(g.pile.length, 0);
  assert.equal(g.turn, first);
  assert.equal(g.rank, null);
  assert.equal(g.round, 2);
  assert.equal(totalCards(g), 108);
});

test('吹牛被抓：出牌者收全部暗牌，质疑者先手', () => {
  const g = setup(4), first = g.turn;
  const card = chooseNormal(g, first);
  const fakeRank = RANKS.find(r => r !== card.rank);
  playCards(g, tokens[first], [card.id], fakeRank);
  const challenger = (first + 1) % 4;
  challenge(g, tokens[challenger]);
  assert.equal(g.phase, 'accusing');
  assertSecret(g);
  resolveAccuse(g);
  assert.equal(g.result.lied, true);
  assert.equal(g.result.receiver, first);
  assert.equal(g.result.starter, challenger);
  assert.equal(g.phase, 'reveal_last');
  assert.ok(publicState(g, tokens[0]).pile[0].card);
  revealRemaining(g);
  startCollect(g);
  completeCollect(g);
  assert.equal(g.turn, challenger);
  assert.equal(totalCards(g), 108);
});

test('质疑真牌失败：质疑者收全部暗牌，原出牌者先手', () => {
  const g = setup(4), i = g.turn, card = chooseNormal(g, i);
  playCards(g, tokens[i], [card.id], card.rank);
  const challenger = (i + 1) % 4;
  challenge(g, tokens[challenger]);
  resolveAccuse(g);
  assert.equal(g.result.lied, false);
  assert.equal(g.result.receiver, challenger);
  assert.equal(g.result.starter, i);
  revealRemaining(g);
  startCollect(g);
  completeCollect(g);
  assert.equal(g.turn, i);
  assert.equal(totalCards(g), 108);
});

test('允许保护期后、下一位玩家尚未出牌时继续质疑上一手', () => {
  const g = setup(4), first = g.turn;
  const card = chooseNormal(g, first);
  playCards(g, tokens[first], [card.id], card.rank);
  finishCooldown(g); // 两秒保护期结束；此时仍然允许质疑上一手
  const challenger = (first + 1) % 4;
  assert.equal(g.phase, 'playing');
  assert.doesNotThrow(() => challenge(g, tokens[challenger]));
  assert.equal(g.phase, 'accusing');
});

test('非本回合玩家出牌、重复牌、超12张、质疑自己都会被拒绝', () => {
  const g = setup(4), i = g.turn, other = (i + 1) % 4;
  assert.equal(MAX_PLAY_CARDS, 12);
  assert.throws(() => playCards(g, tokens[other], [g.players[other].hand[0].id], '3'));
  const one = g.players[i].hand[0].id;
  assert.throws(() => playCards(g, tokens[i], [one, one], '3'));
  assert.throws(() => playCards(g, tokens[i], g.players[i].hand.slice(0, 13).map(c => c.id), '3'));
  playCards(g, tokens[i], [one], '3');
  assert.throws(() => challenge(g, tokens[i]));
  assert.equal(totalCards(g), 108);
});

test('最后一手真牌质疑失败可以获胜；假牌被抓不能获胜', () => {
  const g = setup(4), i = g.turn, keep = chooseNormal(g, i);
  const hand = g.players[i].hand;
  g.players[(i + 1) % 4].hand.push(...hand.filter(c => c.id !== keep.id));
  g.players[i].hand = [keep];
  playCards(g, tokens[i], [keep.id], keep.rank);
  challenge(g, tokens[(i + 1) % 4]);
  resolveAccuse(g); revealRemaining(g); startCollect(g); completeCollect(g);
  assert.equal(g.winner, i);
  assert.equal(g.phase, 'finished');
  assert.equal(totalCards(g), 108);

  const h = setup(4), j = h.turn, real = chooseNormal(h, j);
  const own = h.players[j].hand;
  h.players[(j + 1) % 4].hand.push(...own.filter(c => c.id !== real.id));
  h.players[j].hand = [real];
  const lie = RANKS.find(r => r !== real.rank);
  playCards(h, tokens[j], [real.id], lie);
  challenge(h, tokens[(j + 1) % 4]);
  resolveAccuse(h); revealRemaining(h); startCollect(h); completeCollect(h);
  assert.equal(h.winner, null);
  assert.ok(h.players[j].hand.length >= 1);
  assert.equal(totalCards(h), 108);
});

test('新回合第一手必须手动选择正确点数', () => {
  const g = setup(4), i = g.turn, card = chooseNormal(g, i);
  assert.throws(() => playCards(g, tokens[i], [card.id], undefined), /请选择正确点数/);
  assert.throws(() => playCards(g, tokens[i], [card.id], ''), /请选择正确点数/);
  assert.throws(() => playCards(g, tokens[i], [card.id], '1'), /请选择正确点数/);
  playCards(g, tokens[i], [card.id], '3');
  challenge(g, tokens[(i + 1) % 4]);
  resolveAccuse(g); revealRemaining(g); startCollect(g); completeCollect(g);
  assert.equal(g.rank, null);
  const j = g.turn, next = chooseNormal(g, j);
  assert.throws(() => playCards(g, tokens[j], [next.id], ''), /请选择正确点数/);
  playCards(g, tokens[j], [next.id], 'K');
  assert.equal(g.rank, 'K');
});

test('单人练习：54张、无彩蛋，每手清桌直到获胜', () => {
  const g = setup(1);
  let moves = 0;
  while (g.phase !== 'finished' && moves < 20) {
    const before = g.players[0].hand.length;
    const ids = g.players[0].hand.slice(0, 8).map(c => c.id);
    playCards(g, tokens[0], ids, 'A');
    assert.equal(totalCards(g), 54);
    finishCooldown(g);
    moves++;
    assert.equal(totalCards(g), 54);
    assert.equal(g.randomEvent, null);
    if (g.phase === 'playing') {
      assert.equal(g.turn, 0);
      assert.equal(g.rank, null);
      assert.equal(g.pile.length, 0);
      assert.equal(g.discard.length, 54 - g.players[0].hand.length);
      assert.ok(g.players[0].hand.length < before);
    }
  }
  assert.equal(moves, 7);
  assert.equal(g.phase, 'finished');
  assert.equal(g.winner, 0);
  assert.equal(g.players[0].hand.length, 0);
});

test('双人模式可以跟牌与质疑，质疑后重开点数为空', () => {
  const g = setup(2), i = g.turn, j = (i + 1) % 2;
  playCards(g, tokens[i], [g.players[i].hand[0].id], 'Q');
  challenge(g, tokens[j]);
  resolveAccuse(g); revealRemaining(g); startCollect(g); completeCollect(g);
  assert.equal(g.round, 2);
  assert.equal(g.rank, null);
  assert.equal(g.phase, 'playing');
  assert.equal(totalCards(g), 54);
});

test('轮次与玩家索引保持有效', () => {
  const g = setup(6);
  assert.equal(playerIndex(g, tokens[0]), 0);
  assert.equal(playerIndex(g, tokens[5]), 5);
  assert.equal(playerIndex(g, 'not-a-player'), -1);
});
