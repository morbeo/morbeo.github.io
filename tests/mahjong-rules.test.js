'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../tools/mahjong/hand.js');
const R = require('../tools/mahjong/rules.js');

const hand = (str, melds = []) => {
  const closed = H.parse(str).tiles;
  return { closed, melds, win: closed[closed.length - 1] };
};
const ctx = (o = {}) => Object.assign({ tsumo: false, seat: 1, round: 0, flowers: [], flags: {}, dora: 0, ura: 0, aka: 0, honba: 0, sticks: 0 }, o);
const labels = (r) => r.patterns.map((p) => p.label);

test('exports the public API', () => {
  for (const k of ['analyze', 'conflicts', 'FLAG_SETS', 'riichiEval', 'hkEval', 'cnEval', 'ccEval', 'twEval', 'mcrEval', 'info']) assert.ok(R[k], k);
});

test('hand parser reads suits, honors and red fives, and rejects bad input', () => {
  assert.equal(H.parse('123m').tiles.length, 3);
  assert.equal(H.parse('055p').reds, 1);
  assert.deepEqual(H.parse('1z7z').tiles, [27, 33]);
  assert.throws(() => H.parse('m'));
  assert.throws(() => H.parse('12'));
  assert.throws(() => H.parse('8z'));
  assert.throws(() => H.parse('1x'));
  assert.equal(H.format(H.parse('321m11z').tiles), '123m11z');
});

test('analyze rejects incomplete and invalid hands with a message', () => {
  const short = R.analyze('riichi', hand('123m'), ctx());
  assert.equal(short.ok, false);
  assert.match(short.error, /14 concealed tiles/);
  const nope = R.analyze('riichi', hand('1379m1379p1379s12z'), ctx());
  assert.equal(nope.ok, false);
});

test('riichi: a closed hand with no yaku does not score', () => {
  const r = R.analyze('riichi', hand('123m456p789s234s55p'), ctx());
  assert.equal(r.ok, false);
  assert.match(r.error, /No yaku/);
});

test('riichi: riichi + ippatsu + tsumo + pinfu + tanyao is a mangan', () => {
  const r = R.analyze('riichi', hand('234m567p345s678s55p'), ctx({ tsumo: true, flags: { riichi: true, ippatsu: true } }));
  assert.equal(r.ok, true);
  assert.deepEqual(labels(r), ['Riichi', 'Ippatsu', 'Menzen tsumo', 'Pinfu', 'Tanyao']);
  assert.equal(r.score.headline, 'Mangan');
  assert.equal(r.score.total, 8000);
});

test('riichi: dora and honba add up', () => {
  const plain = R.analyze('riichi', hand('234m567p345s678s55p'), ctx({ dora: 2 }));
  assert.equal(plain.ok, true);
  assert.ok(labels(plain).includes('Dora'));
  assert.equal(plain.score.total, 7700);
  const honba = R.analyze('riichi', hand('234m567p345s678s55p'), ctx({ dora: 2, honba: 1 }));
  assert.equal(honba.score.total, 8000);
});

test('riichi: dealer tsumo pays from everyone', () => {
  const r = R.analyze('riichi', hand('123m456p789s234s55p'), ctx({ seat: 0, tsumo: true }));
  assert.equal(r.ok, true);
  assert.deepEqual(labels(r), ['Menzen tsumo']);
  assert.equal(r.score.total, 1500);
});

test('riichi: chiitoitsu, kokushi and daisuushii', () => {
  const chii = R.analyze('riichi', hand('1122m3344p5566s77z'), ctx());
  assert.deepEqual(labels(chii), ['Chiitoitsu']);
  assert.equal(chii.score.sub.includes('25 fu'), true);
  const kok = R.analyze('riichi', hand('19m19p19s12345677z'), ctx());
  assert.equal(kok.score.headline, '2× Yakuman');
  assert.equal(kok.score.total, 64000);
  const dbl = R.analyze('riichi', hand('111z222z333z444z55m'), ctx());
  assert.equal(dbl.score.headline, '4× Yakuman');
  const single = R.analyze('riichi', hand('111z222z333z444z55m'), ctx(), { doubleYakuman: false });
  assert.equal(single.score.headline, '2× Yakuman');
});

test('riichi: an open hand still scores with a yaku, and open riichi is refused', () => {
  const open = R.analyze('riichi', hand('234m567p345s55p', [{ k: 'chow', t: 23, open: true }]), ctx());
  assert.equal(open.ok, true);
  assert.deepEqual(labels(open), ['Tanyao']);
  const bad = R.analyze('riichi', hand('234m567p345s55p', [{ k: 'chow', t: 23, open: true }]), ctx({ flags: { riichi: true } }));
  assert.equal(bad.ok, false);
  assert.match(bad.error, /closed hand/);
  const yaku = R.analyze('riichi', hand('234m567p55p', [{ k: 'chow', t: 20, open: true }, { k: 'pung', t: 31, open: true }]), ctx());
  assert.deepEqual(labels(yaku), ['Yakuhai: White dragon']);
});

test('conflicts: contradictory ticks are reported', () => {
  assert.deepEqual(R.conflicts('riichi', null, ctx()), []);
  assert.deepEqual(R.conflicts('riichi', null, ctx({ flags: { heavenly: true } })), [
    'Heavenly hand is for the dealer: set the seat to East.',
    'Heavenly hand is a self-drawn win: tick Self-drawn.',
  ]);
  assert.match(R.conflicts('riichi', null, ctx({ flags: { ippatsu: true } }))[0], /Ippatsu needs riichi/);
  assert.match(R.conflicts('riichi', null, ctx({ flags: { lastWall: true } }))[0], /self-drawn/);
  assert.match(R.conflicts('riichi', null, ctx({ tsumo: true, flags: { lastDiscard: true } }))[0], /untick Self-drawn/);
  assert.match(R.conflicts('riichi', null, ctx({ tsumo: true, flags: { robKong: true } }))[0], /Robbing a kong/);
  assert.match(R.conflicts('riichi', null, ctx({ seat: 0, tsumo: true, flags: { heavenly: true, earthly: true } }))[0], /cannot both/);
  assert.match(R.conflicts('riichi', null, ctx({ seat: 0, flags: { earthly: true } }))[0], /non-dealer/);
  assert.match(R.conflicts('hk', null, ctx({ tsumo: true, flags: { earthly: true } }))[0], /untick Self-drawn/);
  assert.match(R.conflicts('tw', null, ctx({ flags: { early: true, early2: true } }))[0], /Only one early-win/);
});

test('conflicts: flags that the ruleset does not have are ignored', () => {
  assert.deepEqual(R.conflicts('mcr', null, ctx({ flags: { riichi: true, ippatsu: true } })), []);
  assert.ok(R.FLAG_SETS.riichi && R.FLAG_SETS.doubleKong === 'hk');
});

test('conflicts: hand-dependent checks', () => {
  const none = hand('234m567p345s678s55p');
  assert.match(R.conflicts('riichi', none, ctx({ tsumo: true, flags: { kongDraw: true } }))[0], /needs a kong/);
  assert.match(R.conflicts('hk', none, ctx({ tsumo: true, flags: { doubleKong: true } }))[0], /two kongs/);
  const called = hand('234m567p55p', [{ k: 'chow', t: 20, open: true }]);
  assert.match(R.conflicts('riichi', called, ctx({ flags: { riichi: true } }))[0], /closed hand/);
});

test('analyze surfaces conflicts as an error', () => {
  const r = R.analyze('riichi', hand('234m567p345s678s55p'), ctx({ flags: { ippatsu: true } }));
  assert.equal(r.ok, false);
  assert.match(r.error, /Ippatsu needs riichi/);
});

test('hong kong: all chows, thirteen orphans', () => {
  const r = R.analyze('hk', hand('234m567p345s678s55p'), ctx());
  assert.equal(r.ok, true);
  assert.ok(labels(r).some((l) => l.startsWith('Common Hand')));
  assert.equal(r.score.total, 8);
  const to = R.analyze('hk', hand('19m19p19s12345677z'), ctx());
  assert.equal(to.score.sub, '13 faan');
  assert.equal(to.score.total, 384);
});

test('hong kong: a limit hand paid by self-draw', () => {
  const r = R.analyze('hk', hand('11122233344455m'), ctx({ tsumo: true }));
  assert.deepEqual(labels(r), ['Self Triplets']);
  assert.equal(r.score.total, 192);
});

test('mainland China (cn), Cantonese-style (cc) and MCR score a hand', () => {
  const cn = R.analyze('cn', hand('11122233344455m'), ctx());
  assert.equal(cn.ok, true);
  assert.equal(cn.score.sub, 'Limit hand');
  const cc = R.analyze('cc', hand('11122233344455m'), ctx());
  assert.equal(cc.ok, true);
  assert.equal(cc.score.total, 6000);
  const mcr = R.analyze('mcr', hand('234m567p345s678s55p'), ctx());
  assert.equal(mcr.ok, true);
  assert.equal(mcr.score.total, 32);
  assert.ok(labels(mcr).includes('All Chows'));
});

test('taiwanese mahjong needs 17 tiles', () => {
  const few = R.analyze('tw', hand('11122233344455m'), ctx());
  assert.equal(few.ok, false);
  assert.match(few.error, /17 concealed tiles/);
  const r = R.analyze('tw', hand('123m456m789m123p456p11s'), ctx());
  assert.equal(r.ok, true);
  assert.ok(r.score.total > 0);
});

test('info reports the structure of an interpretation', () => {
  const I = H.interpretations(hand('234m567p345s678s55p'), { setsTotal: 4 })[0];
  const f = R.info(I, ctx());
  assert.equal(f.chows.length, 4);
  assert.equal(f.pungs.length, 0);
  assert.equal(f.hasHonor, false);
  assert.equal(f.suits.size, 3);
  assert.equal(f.seatT, 28);
});
