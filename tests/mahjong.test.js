'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../tools/mahjong/hand.js');
const R = require('../tools/mahjong/rules.js');

const mk = (closed, win) => ({ closed: H.parse(closed).tiles, melds: [], win: H.parse(win).tiles[0] });
const ctx = (flags = {}, over = {}) => Object.assign(
  { tsumo: false, seat: 1, round: 0, flowers: Array(8).fill(false), flags, dora: 0, ura: 0, aka: 0, honba: 0, sticks: 0 }, over);
const labels = (r) => r.patterns.map((p) => p.label);

test('parse reads suits, honors and red fives', () => {
  assert.deepEqual(H.parse('19m1z').tiles, [0, 8, 27]);
  assert.equal(H.parse('055m').reds, 1);
  assert.equal(H.format(H.parse('1112345678999m').tiles), '1112345678999m');
});

test('parse rejects malformed input', () => {
  assert.throws(() => H.parse('12'), /need a suit/);
  assert.throws(() => H.parse('12x'), /Unexpected/);
  assert.throws(() => H.parse('8z'), /Honors/);
  assert.throws(() => H.parse('m'), /no digits/);
});

test('tile classification helpers', () => {
  assert.ok(H.isTerm(0) && H.isTerm(8) && !H.isTerm(4));
  assert.ok(H.isHonor(27) && H.isWind(30) && H.isDragon(31) && !H.isDragon(30));
  assert.ok(H.isSimple(4) && !H.isSimple(27));
  assert.equal(H.tileName(27), 'East');
  assert.equal(H.tileName(9), '1p');
});

test('check rejects wrong tile count', () => {
  assert.match(H.check(mk('123m', '1m'), 4), /Need 14 concealed tiles/);
});

test('decomposition finds interpretations of a winning hand', () => {
  assert.equal(H.interpretations(mk('11m22m33p44p55s66s77z', '7z'), { setsTotal: 4, tsumo: false }).length, 1);
  assert.ok(H.interpretations(mk('11122233344455m', '5m'), { setsTotal: 4 }).length > 1);
});

test('non-winning hand is rejected by analyze', () => {
  const r = R.analyze('riichi', mk('123m456m789m234p56s', '5s'), ctx());
  assert.equal(r.ok, false);
  assert.match(r.error, /not a complete winning hand/);
});

test('riichi: ittsu ron scores 2 han 40 fu', () => {
  const r = R.analyze('riichi', mk('123m456m789m234p55s', '5s'), ctx());
  assert.ok(r.ok);
  assert.deepEqual(labels(r), ['Ittsu']);
  assert.equal(r.score.total, 2600);
});

test('riichi: riichi and tsumo add han and change payments', () => {
  const r = R.analyze('riichi', mk('123m456m789m234p55s', '5s'), ctx({ riichi: true }, { tsumo: true, seat: 0 }));
  assert.ok(r.ok);
  assert.deepEqual(labels(r), ['Riichi', 'Menzen tsumo', 'Ittsu']);
  assert.equal(r.score.total, 11700);
});

test('riichi: seven pairs scores chiitoitsu 25 fu', () => {
  const r = R.analyze('riichi', mk('11m22m33p44p55s66s77z', '7z'), ctx());
  assert.ok(r.ok);
  assert.deepEqual(labels(r), ['Chiitoitsu']);
  assert.equal(r.score.total, 1600);
});

test('hong kong: concealed common hand', () => {
  const r = R.analyze('hk', mk('123m456m789m234p55s', '5s'), ctx());
  assert.ok(r.ok);
  assert.ok(labels(r).includes('Fully concealed'));
  assert.equal(r.score.total, 8);
});

test('hong kong: 13-tile hand is rejected with a count message', () => {
  const r = R.analyze('hk', mk('11123m456p789s77z', '3m'), ctx());
  assert.equal(r.ok, false);
  assert.match(r.error, /Need 14/);
});

test('mcr: pure straight, self-draw scores more than ron', () => {
  const ron = R.analyze('mcr', mk('123m456m789m234p55s', '5s'), ctx());
  const tsumo = R.analyze('mcr', mk('123m456m789m234p55s', '5s'), ctx({}, { tsumo: true }));
  assert.ok(ron.ok && tsumo.ok);
  assert.ok(labels(ron).includes('Pure Straight'));
  assert.equal(ron.score.headline, '22 points');
  assert.equal(tsumo.score.headline, '24 points');
});

test('taiwanese ruleset requires 17 tiles', () => {
  const r = R.analyze('tw', mk('123m456m789m234p55s', '5s'), ctx());
  assert.equal(r.ok, false);
  assert.match(r.error, /Need 17/);
});
