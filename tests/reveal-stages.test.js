import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshGame, addPlayer, startGame, beginTurn, playCards, finishCooldown,
  challenge, resolveAccuse, revealRemaining, startCollect, completeCollect,
  publicState, totalCards, expectedCardCount, tick, RANDOM_EVENT_TYPES
} from '../server/game.js';

const tokens = Array.from({ length: 6 }, (_, i) =>
  `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
);
function setup(n = 4) {
  const g = freshGame('STAG77', n);
  for (let i = 0; i < n; i++) addPlayer(g, tokens[i], `玩家${i + 1}`);
  startGame(g, tokens[0], tokens.slice(0, n));
  beginTurn(g);
  // 此文件只测试揭牌顺序；禁止 3% 的意外翻牌彩蛋污染隐私断言。
  g.randomEventUsed = Object.fromEntries(RANDOM_EVENT_TYPES.map(type => [type, true]));
  return g;
}
function view(g) {
  return publicState(g, tokens[0], tokens.slice(0, g.players.length));
}

test('质疑先公开上一手，再公开全部牌，最终牌数守恒', () => {
  const g = setup(4), a = g.turn;
  const firstHand = g.players[a].hand;
  playCards(g, tokens[a], [firstHand[0].id, firstHand[1].id], 'K');
  finishCooldown(g);
  const b = g.turn;
  playCards(g, tokens[b], [g.players[b].hand[0].id], 'K');
  const lastMove = g.last.moveId;
  assert.ok(g.pile.some(p => p.moveId !== lastMove));

  challenge(g, tokens[(b + 1) % 4]);
  assert.equal(g.phase, 'accusing');
  assert.ok(view(g).pile.every(p => !('card' in p)), '质疑喊话期间不得泄漏牌面');

  resolveAccuse(g);
  assert.equal(g.phase, 'reveal_last');
  assert.equal(typeof g.result.lied, 'boolean');
  const first = view(g);
  assert.equal(first.pile.filter(p => p.card).length, 1);
  assert.ok(first.pile.every(p => p.moveId === lastMove ? Boolean(p.card) : !('card' in p)),
    '第一阶段只能公开最后被质疑的一手');

  revealRemaining(g);
  assert.equal(g.phase, 'reveal');
  assert.ok(view(g).pile.every(p => p.card), '第二阶段必须公开全部牌面');
  assert.ok(g.phaseUntil - Date.now() >= 2000, '须留出查看牌面的时间');
  startCollect(g);
  assert.equal(g.phase, 'collecting');
  assert.ok(view(g).pile.every(p => p.card), '收牌时仍应能看到公开牌面');
  completeCollect(g);
  assert.equal(g.round, 2);
  assert.equal(totalCards(g), expectedCardCount(4));
});

test('挑战方无法在第一阶段看到更早的手牌', () => {
  const g = setup(3), a = g.turn;
  playCards(g, tokens[a], [g.players[a].hand[0].id], 'A');
  finishCooldown(g);
  const b = g.turn;
  playCards(g, tokens[b], g.players[b].hand.slice(0, 3).map(c => c.id), 'A');
  challenge(g, tokens[(b + 1) % 3]);
  resolveAccuse(g);
  const staged = view(g);
  assert.equal(staged.pile.filter(p => p.card).length, 3);
  assert.ok(staged.pile.every(p => p.moveId === g.last.moveId ? Boolean(p.card) : !('card' in p)));
  assert.equal(totalCards(g), 108);
  g.phaseUntil = Date.now() - 1;
  assert.equal(tick(g), true);
  assert.equal(g.phase, 'reveal');
  assert.equal(view(g).pile.filter(p => p.card).length, 4);
});
