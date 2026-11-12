/* Pattern detection per ruleset. Input: tiles + situation. Output: patterns scored + payments.
 *   analyze(ruleset, hand, ctx, opt)
 *   hand = { closed: [tiles incl. winning tile], melds: [{k, t, open}], win }
 *   ctx  = { tsumo, seat 0-3 (0 = East/dealer), round 0-3, flowers: bool[8] (4 flowers, 4 seasons),
 *            flags: { riichi, dblRiichi, ippatsu, lastWall, lastDiscard, kongDraw, robKong, heavenly, earthly,
 *                     fourthTile, doubleKong, early, early2, readyOriginal }, dora, ura, aka, honba, sticks }
 */
(function (root) {
  'use strict';
  const H = root.MahjongHand || (typeof require !== 'undefined' ? require('./hand.js') : null);
  const M = root.Mahjong || (typeof require !== 'undefined' ? require('./mahjong.js') : null);

  /* ───────── shared structure helpers ───────── */

  function info(I, ctx) {
    const sets = I.sets || [];
    const all = H.tilesOf(I);
    const chows = sets.filter((s) => s.k === 'chow');
    const pungs = sets.filter((s) => s.k !== 'chow'); // pungs and kongs
    const kongs = sets.filter((s) => s.k === 'kong');
    const seatT = 27 + ctx.seat;
    const roundT = 27 + ctx.round;
    const suits = new Set(all.filter((t) => t < 27).map(H.suitOf));
    return {
      sets, all, chows, pungs, kongs, seatT, roundT, suits,
      standard: !I.special,
      hasHonor: all.some(H.isHonor),
      dragonPungs: pungs.filter((s) => H.isDragon(s.t)),
      windPungs: pungs.filter((s) => H.isWind(s.t)),
      concealedPungs: pungs.filter((s) => !s.open && !s.ron),
      openAny: sets.some((s) => s.open),
      pairValue: I.pair != null && (H.isDragon(I.pair) || I.pair === seatT || I.pair === roundT),
      oneSuit: suits.size === 1,
    };
  }

  const countPairs = (arr) => {
    const m = {};
    arr.forEach((t) => { m[t] = (m[t] || 0) + 1; });
    return Object.values(m).reduce((a, n) => a + Math.floor(n / 2), 0);
  };
  const hasChowRun = (chows, suit, step) => [0, 3, 6].every((o) => chows.some((c) => c.t === suit * 9 + (o / 3) * step));
  const sameNumberSuits = (sets, n) => [0, 1, 2].every((s) => sets.some((x) => x.t === s * 9 + n));
  const hasSanshokuChow = (chows) => [0, 1, 2, 3, 4, 5, 6].some((n) => sameNumberSuits(chows, n));
  const hasSanshokuPung = (pungs) => [0, 1, 2, 3, 4, 5, 6, 7, 8].some((n) => sameNumberSuits(pungs, n));
  const hasIttsu = (chows) => [0, 1, 2].some((s) => [0, 3, 6].every((o) => chows.some((c) => c.t === s * 9 + o)));
  const flowerStats = (ctx) => {
    const fl = ctx.flowers || [];
    const flowers = fl.slice(0, 4).filter(Boolean).length;
    const seasons = fl.slice(4, 8).filter(Boolean).length;
    return { flowers, seasons, total: flowers + seasons, ownFlower: !!fl[ctx.seat], ownSeason: !!fl[4 + ctx.seat] };
  };
  const GREEN = [19, 20, 21, 23, 25, 32]; // 2 3 4 6 8 bamboo, green dragon
  const allTH = (I, f) => f.all.every(H.isTH);

  /* ───────── Riichi ───────── */

  function riichiEval(I, hand, ctx, opt) {
    const f = info(I, ctx);
    const { sets, all, chows, pungs, kongs } = f;
    const menzen = !f.openAny;
    const tsumo = !!ctx.tsumo;
    const fl = ctx.flags || {};
    const Y = [];
    const YM = [];
    const y = (label, han) => Y.push({ label, value: han + ' han', han });
    const yakuman = (label, mult) => YM.push({ label, value: mult > 1 ? mult + '× yakuman' : 'yakuman', mult });
    const noSuit = f.suits.size === 0;
    const dbl = opt.doubleYakuman !== false;

    // ---- yakuman
    if (I.special === 'kokushi') yakuman('Kokushi musou' + (I.thirteenWait ? ' (13-sided wait)' : ''), I.thirteenWait && dbl ? 2 : 1);
    if (f.standard) {
      if (f.dragonPungs.length === 3) yakuman('Daisangen', 1);
      if (f.windPungs.length === 4) yakuman('Daisuushii', dbl ? 2 : 1);
      else if (f.windPungs.length === 3 && H.isWind(I.pair)) yakuman('Shousuushii', 1);
      if (f.concealedPungs.length === 4) yakuman('Suuankou' + (I.wait === 'tanki' ? ' (tanki)' : ''), I.wait === 'tanki' && dbl ? 2 : 1);
      if (kongs.length === 4) yakuman('Suukantsu', 1);
      if (menzen && f.oneSuit && !f.hasHonor && all.length === 14) {
        const base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
        const c = new Array(9).fill(0);
        all.forEach((t) => c[t % 9]++);
        if (c.every((n, i) => n >= base[i])) {
          const pre = c.slice();
          pre[hand.win % 9]--;
          const pure = pre.every((n, i) => n === base[i]);
          yakuman('Chuuren poutou' + (pure ? ' (pure)' : ''), pure && dbl ? 2 : 1);
        }
      }
    }
    if (all.every(H.isHonor)) yakuman('Tsuuiisou', 1);
    if (all.every(H.isTerm)) yakuman('Chinroutou', 1);
    if (all.every((t) => GREEN.includes(t))) yakuman('Ryuuiisou', 1);
    if (fl.heavenly && tsumo && ctx.seat === 0) yakuman('Tenhou', 1);
    if (fl.earthly && tsumo && ctx.seat !== 0) yakuman('Chiihou', 1);

    // ---- fu (needed for ranking readings)
    const chiitoi = I.special === 'chiitoi';
    let pinfu = false;
    if (f.standard && menzen && chows.length === 4 && !f.pairValue && I.wait === 'ryanmen') pinfu = true;
    let fu = 25;
    if (!chiitoi && f.standard) {
      const codes = sets.map((s) => (s.k === 'chow' ? 'seq' : (s.k === 'kong' ? 'kan' : 'tri') + '_' + (H.isTH(s.t) ? 't' : 's') + '_' + (s.open || s.ron ? 'o' : 'c')));
      let pairFu = 0;
      if (H.isDragon(I.pair)) pairFu += 2;
      if (I.pair === f.seatT) pairFu += 2;
      if (I.pair === f.roundT) pairFu += 2;
      if (pairFu === 4 && opt.doubleWindPair === 2) pairFu = 2;
      fu = M.riichiFu({ tsumo, open: !menzen, melds: codes, pair: pairFu, wait: ['kanchan', 'penchan', 'tanki'].includes(I.wait), pinfu, chiitoi: false });
    }

    let mult = YM.reduce((a, b) => a + b.mult, 0);
    if (mult) {
      const score = M.riichiScore({ han: 0, fu, yakuman: mult, dealer: ctx.seat === 0, tsumo, honba: ctx.honba || 0, sticks: ctx.sticks || 0 });
      return { patterns: YM.map(({ label, value }) => ({ label, value })), han: 0, fu, yakuman: mult, score, rank: score.total * 1000 };
    }

    // ---- regular yaku
    const riichi = menzen && (fl.riichi || fl.dblRiichi);
    if (riichi && fl.dblRiichi) y('Double riichi', 2);
    else if (riichi) y('Riichi', 1);
    if (riichi && fl.ippatsu) y('Ippatsu', 1);
    if (menzen && tsumo) y('Menzen tsumo', 1);
    if (fl.lastWall && tsumo) y('Haitei raoyue', 1);
    if (fl.lastDiscard && !tsumo) y('Houtei raoyui', 1);
    if (fl.kongDraw && tsumo) y('Rinshan kaihou', 1);
    if (fl.robKong && !tsumo) y('Chankan', 1);
    if (chiitoi && !I.dup) y('Chiitoitsu', 2);
    if (chiitoi && I.dup) return { patterns: [], error: 'Chiitoitsu needs seven different pairs.', rank: -1 };
    if (pinfu) y('Pinfu', 1);
    if (f.standard && menzen) {
      const pairs = countPairs(chows.map((c) => c.t));
      if (pairs >= 2) y('Ryanpeikou', 3);
      else if (pairs === 1) y('Iipeikou', 1);
    }
    if (all.every(H.isSimple)) y('Tanyao', 1);
    if (f.standard) {
      f.dragonPungs.forEach((s) => y('Yakuhai: ' + H.tileName(s.t) + ' dragon', 1));
      f.windPungs.forEach((s) => {
        if (s.t === f.seatT) y('Yakuhai: seat wind', 1);
        if (s.t === f.roundT) y('Yakuhai: round wind', 1);
      });
      if (hasSanshokuChow(chows)) y('Sanshoku doujun', menzen ? 2 : 1);
      if (hasIttsu(chows)) y('Ittsu', menzen ? 2 : 1);
      const th = sets.every((s) => (s.k === 'chow' ? s.t % 9 === 0 || s.t % 9 === 6 : H.isTH(s.t))) && H.isTH(I.pair);
      if (th && chows.length > 0) {
        if (f.hasHonor) y('Chanta', menzen ? 2 : 1);
        else y('Junchan', menzen ? 3 : 2);
      }
      if (pungs.length === 4) y('Toitoi', 2);
      if (f.concealedPungs.length === 3) y('Sanankou', 2);
      if (hasSanshokuPung(pungs)) y('Sanshoku doukou', 2);
      if (kongs.length === 3) y('Sankantsu', 2);
      if (f.dragonPungs.length === 2 && H.isDragon(I.pair)) y('Shousangen', 2);
    }
    if (all.every(H.isTH) && !all.every(H.isHonor)) y('Honroutou', 2);
    if (f.oneSuit && f.hasHonor) y('Honitsu', menzen ? 3 : 2);
    if (f.oneSuit && !f.hasHonor) y('Chinitsu', menzen ? 6 : 5);

    const yakuHan = Y.reduce((a, b) => a + b.han, 0);
    if (yakuHan === 0) return { patterns: [], error: 'No yaku: a hand needs at least one yaku (dora alone does not count).', rank: -1 };
    const doraN = (ctx.dora || 0) + (ctx.ura || 0) + (ctx.aka || 0);
    const patterns = Y.map(({ label, value }) => ({ label, value }));
    if (ctx.dora) patterns.push({ label: 'Dora', value: ctx.dora + ' han' });
    if (ctx.ura && riichi) patterns.push({ label: 'Ura dora', value: ctx.ura + ' han' });
    if (ctx.aka) patterns.push({ label: 'Red fives', value: ctx.aka + ' han' });
    const bonus = (ctx.dora || 0) + (riichi ? ctx.ura || 0 : 0) + (ctx.aka || 0);
    const han = yakuHan + bonus;
    const score = M.riichiScore({ han, fu, dealer: ctx.seat === 0, tsumo, honba: ctx.honba || 0, sticks: ctx.sticks || 0, kazoe: opt.kazoe !== false, kiriage: !!opt.kiriage });
    return { patterns, han, fu, yakuman: 0, score, rank: score.ok ? score.total * 1000 + han : -1 };
  }

  /* ───────── Hong Kong ───────── */

  function hkEval(I, hand, ctx, opt) {
    const f = info(I, ctx);
    const { chows, pungs, kongs, all } = f;
    const fl = ctx.flags || {};
    const tsumo = !!ctx.tsumo;
    const items = [];
    const add = (label, v) => items.push({ label, value: v + ' faan', v });
    const limits = [];
    const lim = (label, v) => limits.push({ label, value: v + ' faan (limit)', v });

    if (I.special === 'kokushi') lim('Thirteen Orphans', 13);
    if (f.standard) {
      if (f.windPungs.length === 4) lim('Great Winds', 13);
      if (kongs.length === 4) lim('All Kongs', 13);
      if (f.concealedPungs.length === 4 && !f.openAny) lim('Self Triplets', 10);
      if (!f.openAny && f.oneSuit && !f.hasHonor && all.length === 14) {
        const base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
        const c = new Array(9).fill(0);
        all.forEach((t) => c[t % 9]++);
        if (c.every((n, i) => n >= base[i])) lim('Nine Gates', 10);
      }
    }
    if (all.every(H.isHonor)) lim('All Honor Tiles', 10);
    if (all.every(H.isTerm)) lim('Orphans (all terminals)', 10);
    if (fl.heavenly && tsumo && ctx.seat === 0) lim('Heavenly Hand', 13);
    if (fl.earthly && !tsumo && ctx.seat !== 0) lim('Earthly Hand', 13);

    let faan;
    let patterns;
    if (limits.length) {
      const top = limits.reduce((a, b) => (b.v > a.v ? b : a));
      patterns = [{ label: top.label, value: top.value }];
      faan = top.v;
    } else {
      if (I.special === 'chiitoi') add('Seven Pairs', 4);
      if (f.standard) {
        if (chows.length === 4 && !f.pairValue) add('Common Hand (all sequences)', 1);
        if (pungs.length === 4) add('All in Triplets', 3);
        if (f.oneSuit && f.hasHonor) add('Mixed One Suit', 3);
        if (f.oneSuit && !f.hasHonor) add('All One Suit', 7);
        if (f.dragonPungs.length === 3) add('Great Dragons', 5);
        else if (f.dragonPungs.length === 2 && H.isDragon(I.pair)) add('Small Dragons', 3);
        if (f.windPungs.length === 3 && H.isWind(I.pair)) add('Small Winds', 6);
        f.dragonPungs.forEach((s) => add('Dragon meld (' + H.tileName(s.t) + ')', 1));
        f.windPungs.forEach((s) => {
          if (s.t === f.seatT) add('Seat wind meld', 1);
          if (s.t === f.roundT) add('Prevailing wind meld', 1);
        });
      } else if (I.special === 'chiitoi') {
        if (f.oneSuit && f.hasHonor) add('Mixed One Suit', 3);
        if (f.oneSuit && !f.hasHonor) add('All One Suit', 7);
      }
      if (all.every(H.isTH)) add('Mixed Orphans', 1);
      const fs = flowerStats(ctx);
      if (fs.total === 0) add('No flowers or seasons', 1);
      if (fs.ownFlower) add('Flower of own seat', 1);
      if (fs.ownSeason) add('Season of own seat', 1);
      if (fs.flowers === 4) add('All four flowers', 2);
      if (fs.seasons === 4) add('All four seasons', 2);
      if (fl.doubleKong && tsumo) add('Win by Double-Kong', 8);
      else if (fl.kongDraw && tsumo) add('Win by Kong (incl. self-pick)', 2);
      else if (tsumo) add('Self-pick', 1);
      if (!f.openAny && f.standard) add('Fully concealed', 1);
      if (fl.robKong && !tsumo) add('Robbing a Kong', 1);
      if (fl.lastWall || fl.lastDiscard) add('Win by last catch', 1);
      faan = items.reduce((a, b) => a + b.v, 0);
      patterns = items.map(({ label, value }) => ({ label, value }));
    }
    const score = M.hkScore({ fan: faan, table: opt.table || 'half', min: opt.min == null ? 3 : opt.min, limit: opt.limit || 13, selfDraw: tsumo, discardPay: opt.discardPay || 'all' });
    return { patterns, faan, score, rank: score.ok ? score.total * 1000 + faan : -1 };
  }

  /* ───────── Chinese New Style ───────── */

  function cnEval(I, hand, ctx, opt) {
    const f = info(I, ctx);
    const { chows, pungs, kongs, all, sets } = f;
    const fl = ctx.flags || {};
    const tsumo = !!ctx.tsumo;
    const items = [];
    const add = (label, v) => items.push({ label, value: v + ' faan', v });

    let isLimit = false;
    let limitLabel = '';
    if (f.standard) {
      if (kongs.length === 4) { isLimit = true; limitLabel = 'Four Kongs'; }
      else if (f.concealedPungs.length === 4) { isLimit = true; limitLabel = 'Hidden Treasure'; }
      else if (f.windPungs.length === 4) { isLimit = true; limitLabel = 'Big Four Winds'; }
    }
    if (all.every(H.isHonor)) { isLimit = true; limitLabel = 'All Honors'; }

    let fullyConcealed = false;
    if (isLimit) {
      items.push({ label: limitLabel, value: '1600% of limit', v: 0 });
    } else {
      const fs = flowerStats(ctx);
      if (f.standard) {
        f.dragonPungs.forEach((s) => add('Dragon pung/kong (' + H.tileName(s.t) + ')', 1));
        f.windPungs.forEach((s) => {
          if (s.t === f.seatT) add('Own wind pung/kong', 1);
          if (s.t === f.roundT) add('Round wind pung/kong', 1);
        });
      }
      if (fs.ownFlower) add('Flower of own wind', 1);
      if (fs.ownSeason) add('Season of own wind', 1);
      if (fs.total === 8) add('All flowers and seasons', 12);
      else {
        if (fs.flowers === 4) add('All flowers', 2);
        if (fs.seasons === 4) add('All seasons', 2);
      }
      if (fs.total === 0) add('No flowers or seasons', 1);
      if (f.standard) {
        if (hasSanshokuChow(chows)) add('Same chow from all suits', 3);
        const ip = countPairs(chows.map((c) => c.t));
        if (ip >= 2) add('Two identical chows twice', 9);
        else if (ip === 1) add('Two identical chows', 2);
        [0, 1, 2].forEach((s) => {
          if (chows.some((c) => c.t === s * 9) && chows.some((c) => c.t === s * 9 + 6)) add('123 and 789 of the same suit', 1);
          if (pungs.some((p) => p.t === s * 9) && pungs.some((p) => p.t === s * 9 + 8)) add('Triplets 1 and 9 of the same suit', 1);
        });
        if (hasIttsu(chows)) add('Three chows of 1 suit, step 3', 3);
        if (f.dragonPungs.length === 3) add('Three Great Scholars', 9);
        else if (f.dragonPungs.length === 2 && H.isDragon(I.pair)) add('Little three dragons', 6);
        if (f.windPungs.length === 3 && H.isWind(I.pair)) add('Little Four Winds', 12);

        const exposed = sets.every((s) => s.open) && I.wait === 'tanki';
        if (exposed) add('Exposed hand (single-tile wait)', 2);
        if (!f.openAny) {
          if (tsumo && kongs.length === 0) { fullyConcealed = true; add('Fully concealed hand', 3); }
          else { add('Concealed hand', 1); }
        }
        if (chows.length === 4 && !f.pairValue) add('Chow hand', 1);
        if (pungs.length === 4) add('Pung hand', 3);
        const allTHtiles = all.every(H.isTH);
        const eachSetTH = sets.every((s) => (s.k === 'chow' ? s.t % 9 === 0 || s.t % 9 === 6 : H.isTH(s.t))) && H.isTH(I.pair);
        if (all.every(H.isSimple)) add('All simples', 1);
        else if (allTHtiles) add('All terminals and honors', 6);
        else if (eachSetTH) add(f.hasHonor ? 'Terminal or honor in each set' : 'Terminal in each set', f.hasHonor ? 2 : 3);
        const sp = new Set(all.filter((t) => t < 27).map(H.suitOf));
        if (sp.size === 3 && all.some(H.isWind) && all.some(H.isDragon)) {
          const setKinds = sets.concat([{ k: 'pair', t: I.pair }]).map((s) => (s.t >= 31 ? 'd' : s.t >= 27 ? 'w' : H.suitOf(s.t)));
          if (new Set(setKinds).size === 5) add('All suits, dragons and winds', 3);
        }
        if (!f.hasHonor && f.suits.size === 2) add('Two suits only', 1);
        if (f.oneSuit && f.hasHonor) add('One suit and honors', 3);
        if (f.oneSuit && !f.hasHonor) add('One suit only', 9);
        // four of a kind spread across sets (not a kong)
        const cnt = H.counts(all);
        cnt.forEach((n, t) => {
          if (n === 4 && !kongs.some((k) => k.t === t)) {
            const inSets = sets.filter((s) => H.setTiles(s).includes(t)).length + (I.pair === t ? 1 : 0);
            add('Four same in ' + (inSets === 2 ? 'two' : inSets === 3 ? 'three' : 'four') + ' sets', 1);
          }
        });
        if (!exposed) {
          if (I.wait === 'kanchan' || I.wait === 'penchan') add('Out on a one-chance chow', 1);
          if (I.wait === 'tanki') add('Out on a pair', 1);
        }
      } else if (I.special === 'chiitoi') {
        if (f.oneSuit && f.hasHonor) add('One suit and honors', 3);
        if (f.oneSuit && !f.hasHonor) add('One suit only', 9);
        if (all.every(H.isSimple)) add('All simples', 1);
        if (all.every(H.isTH)) add('All terminals and honors', 6);
        add('Out on a pair', 1);
      }
      if (tsumo && !fullyConcealed) items.push({ label: 'Self-drawn last tile', value: '1 faan (added automatically)', v: 0 });
      if (fl.fourthTile) add('Out on 4th of its kind', 1);
      if (fl.lastWall) add('Out on the last tile of the wall', 1);
      if (fl.lastDiscard) add('Out on the last discard', 1);
      if (fl.kongDraw) add('Out on a supplement tile', 1);
      if (fl.robKong) add('Out by robbing a kong', 1);
    }
    const faan = items.reduce((a, b) => a + b.v, 0);
    const score = M.cnScore({ faan, isLimit, selfDraw: tsumo, fullyConcealed, min: opt.min || 0 });
    return { patterns: items.map(({ label, value }) => ({ label, value })), faan, score, rank: score.ok ? score.total * 1000 + faan : -1 };
  }

  /* ───────── Chinese Classical ───────── */

  function ccEval(I, hand, ctx, opt, waitCount) {
    const f = info(I, ctx);
    const { chows, pungs, kongs, all, sets } = f;
    const fl = ctx.flags || {};
    const tsumo = !!ctx.tsumo;
    const fs = flowerStats(ctx);
    const pts = [{ label: 'Winning', value: '10 pts', v: 10 }];
    const dbl = [];
    const P = (label, v) => pts.push({ label, value: v + ' pts', v });
    const D = (label, v) => dbl.push({ label, value: v + ' dbl', v });
    const limits = [];

    if (f.standard) {
      if (all.every((t) => GREEN.includes(t))) limits.push('All Green');
      if (kongs.length === 4) limits.push('Four Kongs');
      if (f.concealedPungs.length === 4) limits.push('Hidden Treasure');
      if (f.dragonPungs.length === 3) limits.push('Three Great Scholars');
      if (f.windPungs.length === 4) limits.push('Big Four Winds');
      if (!f.openAny && f.oneSuit && !f.hasHonor) {
        const base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
        const c = new Array(9).fill(0);
        all.forEach((t) => c[t % 9]++);
        if (all.length === 14 && c.every((n, i) => n >= base[i])) limits.push('Nine Gates');
        else limits.push('Fully Concealed Suit Hand');
      }
    }
    if (I.special === 'kokushi') limits.push('Thirteen Orphans');
    if (all.every(H.isHonor)) limits.push('All Honors');
    if (all.every(H.isTerm)) limits.push('All Terminals');
    if (fl.heavenly && tsumo && ctx.seat === 0) limits.push('Heavenly Hand');
    if (fl.earthly && !tsumo && ctx.seat !== 0) limits.push('Earthly Hand');
    // "Fully Concealed Suit Hand" needs a self-drawn win
    const filtered = limits.filter((l) => l !== 'Fully Concealed Suit Hand' || tsumo);
    if (filtered.length) {
      const score = M.ccScore({ points: 10, doubles: 0, limit: opt.limit || 1000, isLimit: true, round: !!opt.round, east: opt.east || 'winner', losers: opt.losers || [0, 0, 0] });
      return { patterns: [{ label: filtered[0], value: 'limit' }], points: 10, doubles: 0, score, rank: score.total };
    }

    if (f.standard) {
      sets.forEach((s) => {
        if (s.k === 'chow') return;
        const concealed = !s.open && !s.ron;
        const simple = H.isSimple(s.t);
        const base = simple ? (concealed ? 4 : 2) : concealed ? 8 : 4;
        const v = s.k === 'kong' ? base * 4 : base;
        P((s.k === 'kong' ? 'Kong' : 'Pung') + ' of ' + (simple ? 'simples' : H.isTerm(s.t) ? 'terminals' : H.isWind(s.t) ? 'winds' : 'dragons') + (concealed ? ', concealed' : ', melded') + ' (' + H.tileName(s.t) + ')', v);
      });
      if (H.isDragon(I.pair)) P('Pair of dragons', 2);
      if (I.pair === f.seatT) P('Pair of own wind', 2);
      if (I.pair === f.roundT) P('Pair of round wind', 2);
    }
    if (fs.total) P('Flowers and seasons (' + fs.total + ')', 4 * fs.total);
    if (tsumo && !fl.lastWall) P('Self-drawn last tile', 2);
    if (I.wait === 'tanki') {
      P('Out on a pair', 2);
      if (H.isTH(hand.win)) P('Out on a major pair', 2);
    }
    if (waitCount === 1 && I.wait !== 'shanpon') P('One-chance hand', 2);

    if (f.standard) {
      const dragonD = f.dragonPungs.length;
      if (dragonD === 3) D('Big Three Dragons', 5);
      else if (dragonD === 2 && H.isDragon(I.pair)) D('Little Three Dragons', 3);
      else f.dragonPungs.forEach((s) => D('Dragon pung/kong (' + H.tileName(s.t) + ')', 1));
      f.windPungs.forEach((s) => {
        if (s.t === f.seatT) D('Pung/kong of own wind', 1);
        if (s.t === f.roundT) D('Pung/kong of round wind', 1);
      });
      if (f.concealedPungs.length === 3) D('Three concealed triplets', 1);
      if (f.windPungs.length === 3 && H.isWind(I.pair)) D('Little Four Winds', 1);
      if (!f.openAny && tsumo) D('Fully concealed hand', 1);
      if (chows.length === 4 && !f.pairValue) D('Chow hand', 1);
      if (pungs.length === 4) D('Pung hand', 1);
      if (all.every(H.isTH)) D('All terminals and honors', 1);
      if (f.oneSuit && f.hasHonor) D('One suit and honors', 1);
      if (f.oneSuit && !f.hasHonor) D('One suit only', 3);
    }
    if (fs.flowers === 4 && fs.seasons === 4) D('All flowers and seasons', 3);
    else {
      if (fs.ownFlower && fs.ownSeason) D('Flower and season of own wind', 1);
      if (fs.flowers === 4) D('All flowers', 1);
      if (fs.seasons === 4) D('All seasons', 1);
    }
    if (fl.lastWall) D('Out on the last tile of the wall', 1);
    if (fl.lastDiscard) D('Out on the last discard', 1);
    if (fl.kongDraw) D('Out on a supplement tile', 1);
    if (fl.robKong) D('Out by robbing a kong', 1);
    if (fl.readyOriginal) D('Ready on first turn', 1);

    const points = pts.reduce((a, b) => a + b.v, 0);
    const doubles = dbl.reduce((a, b) => a + b.v, 0);
    const score = M.ccScore({ points, doubles, limit: opt.limit || 1000, isLimit: false, round: !!opt.round, east: opt.east || 'winner', losers: opt.losers || [0, 0, 0] });
    return { patterns: pts.concat(dbl).map(({ label, value }) => ({ label, value })), points, doubles, score, rank: score.total };
  }

  /* ───────── Taiwanese (16 tiles, 5 sets) ───────── */

  function twEval(I, hand, ctx, opt) {
    const f = info(I, ctx);
    const { chows, pungs, kongs, all, sets } = f;
    const fl = ctx.flags || {};
    const tsumo = !!ctx.tsumo;
    const fs = flowerStats(ctx);
    const items = [];
    const add = (label, v) => items.push({ label, value: v + ' tai', v });
    let special = 0;
    let specialLabel = '';
    const sp = (label, v) => { if (v > special) { special = v; specialLabel = label; } };

    if (fs.total === 8) sp('All flowers and seasons', 30);
    if (f.standard) {
      if (f.dragonPungs.length === 3) sp('Three Great Scholars', 30);
      if (f.windPungs.length === 4) sp('Big Four Winds', 40);
      else if (f.windPungs.length === 3 && H.isWind(I.pair)) sp('Little Four Winds', 30);
    }
    if (I.special === 'pairs17') sp('Seven pairs and a triplet', 30);
    if (fl.heavenly && tsumo && ctx.seat === 0) sp('Heavenly Hand', 40);
    if (fl.earthly && !tsumo && ctx.seat !== 0) sp('Earthly Hand', 40);
    if (special) {
      const score = M.twScore({ tai: 0, special, selfDraw: tsumo, base: opt.base || 0, unit: opt.unit == null ? 1 : opt.unit, limit: opt.limit || 0 });
      return { patterns: [{ label: specialLabel, value: special + ' tai' }], score, rank: special };
    }

    let fully = false;
    if (fs.total) add('Flowers and seasons (' + fs.total + ')', fs.total);
    if (f.standard) {
      const honorSets = pungs.filter((s) => H.isHonor(s.t));
      if (honorSets.length) add('Pung/kong of honors ×' + honorSets.length, honorSets.length);
      const melded = kongs.filter((k) => k.open).length;
      const concealedK = kongs.length - melded;
      if (melded) add('Melded kong ×' + melded, melded);
      if (concealedK) add('Concealed kong ×' + concealedK * 1, concealedK * 2);
      const cp = f.concealedPungs.length;
      if (cp === 5) add('Five concealed triplets', 40);
      else if (cp === 4) add('Four concealed triplets', 15);
      else if (cp === 3) add('Three concealed triplets', 5);
      else if (cp === 2) add('Two concealed triplets', 2);
      if (hasIttsu(chows)) {
        const allClosed = [0, 1, 2].some((s) => [0, 3, 6].every((o) => chows.some((c) => c.t === s * 9 + o && !c.open)));
        add('Three chows of 1 suit, step 3' + (allClosed ? ' (concealed)' : ''), allClosed ? 10 : 5);
      }
      if (f.dragonPungs.length === 2 && H.isDragon(I.pair)) add('Little three dragons', 15);
      if (f.windPungs.length === 3) add('Big three winds', 15);
      else if (f.windPungs.length === 2 && H.isWind(I.pair)) add('Little three winds', 5);
      const exposed = sets.every((s) => s.open) && I.wait === 'tanki';
      if (exposed) add('Exposed hand (single-tile wait)', 10);
      if (!f.openAny) {
        if (tsumo) { fully = true; add('Fully concealed hand', 3); } else add('Concealed hand', 1);
      }
      if (chows.length === 5) {
        if (!f.hasHonor && fs.total === 0) add('Chow hand, no honors or flowers', 10);
        else add('Chow hand', 3);
      }
      if (pungs.length === 5) add('Pung hand', 10);
      if (!f.hasHonor) {
        if (fs.total === 0) add('No flowers and no honors', 3);
        else add('No honors', 1);
      }
      if (f.hasHonor || true) {
        if (f.oneSuit && f.hasHonor) add('One suit and honors', 10);
        if (f.oneSuit && !f.hasHonor) add('One suit only', 40);
      }
      if (fs.total === 0 && f.hasHonor) add('No flowers or seasons', 1);
      if (!exposed) {
        if (I.wait === 'kanchan' || I.wait === 'penchan') add('Out on a one-chance chow', 1);
        if (I.wait === 'tanki') add('Out on a pair', 1);
      }
    }
    if (fl.lastWall) add('Out on the last tile of the wall', 1);
    if (fl.robKong) add('Out by robbing a kong', 1);
    if (fl.early2) add('Early winning (5 or fewer discards)', 10);
    else if (fl.early) add('Early winning (6–9 discards)', 5);
    if (fl.readyOriginal) add('Ready on original hand', 15);

    const tai = items.reduce((a, b) => a + b.v, 0);
    const score = M.twScore({ tai, selfDraw: tsumo, fullyConcealed: fully, concealed: false, base: opt.base || 0, unit: opt.unit == null ? 1 : opt.unit, limit: opt.limit || 0 });
    const patterns = [{ label: 'Winning', value: '2 tai (automatic)' }];
    if (tsumo && !fully) patterns.push({ label: 'Self-drawn last tile', value: '1 tai (automatic)' });
    return { patterns: patterns.concat(items.map(({ label, value }) => ({ label, value }))), tai, score, rank: score.ok ? score.total : -1 };
  }

  /* ───────── Chinese Official (MCR) ───────── */

  function mcrEval(I, hand, ctx, opt) {
    const f = info(I, ctx);
    const { chows, pungs, kongs, all, sets } = f;
    const fl = ctx.flags || {};
    const tsumo = !!ctx.tsumo;
    const fs = flowerStats(ctx);
    const cands = [];
    const P = (label, v, ex, n) => { if (n === undefined || n > 0) cands.push({ label, v, n: n || 1, ex: ex || [] }); };
    const seatT = f.seatT;
    const roundT = f.roundT;
    const suitTiles = all.filter((t) => t < 27);
    const cnt = H.counts(all);
    const noHonors = !f.hasHonor;
    const concealedHand = !f.openAny && sets.every((s) => !s.open); // no melded sets
    const nums = suitTiles.map((t) => (t % 9) + 1);
    const chowKey = (c) => ({ suit: H.suitOf(c.t), n: (c.t % 9) + 1 });
    const pungKey = (p) => ({ suit: H.suitOf(p.t), n: (p.t % 9) + 1 });
    const countSets = sets.length;

    if (I.special === 'kokushi') P('Thirteen Orphans', 88, ['All Types', 'Concealed Hand', 'Single Wait', 'Fully Concealed Hand']);
    if (I.special === 'chiitoi') {
      const ps = I.pairs.slice().sort((a, b) => a - b);
      const consecutive = ps.every((t, i) => t < 27 && (i === 0 || t === ps[i - 1] + 1)) && new Set(ps.map(H.suitOf)).size === 1 && !I.dup;
      if (consecutive) P('Seven Shifted Pairs', 88, ['Seven Pairs', 'Full Flush', 'Concealed Hand', 'Single Wait', 'No Honors', 'One Voided Suit']);
      else P('Seven Pairs', 24, ['Concealed Hand', 'Single Wait']);
    }
    if (f.standard) {
      // winds and dragons
      if (f.windPungs.length === 4) P('Big Four Winds', 88, ['Big Three Winds', 'All Pungs', 'Pung of Terminals or Honors', 'Prevalent Wind', 'Seat Wind']);
      else if (f.windPungs.length === 3 && H.isWind(I.pair)) P('Little Four Winds', 64, ['Big Three Winds', 'Pung of Terminals or Honors', 'Prevalent Wind', 'Seat Wind']);
      else if (f.windPungs.length === 3) P('Big Three Winds', 12, ['Pung of Terminals or Honors', 'Prevalent Wind', 'Seat Wind']);
      if (f.dragonPungs.length === 3) P('Big Three Dragons', 88, ['Little Three Dragons', 'Two Dragon Pungs', 'Dragon Pung', 'Pung of Terminals or Honors']);
      else if (f.dragonPungs.length === 2 && H.isDragon(I.pair)) P('Little Three Dragons', 64, ['Two Dragon Pungs', 'Dragon Pung', 'Pung of Terminals or Honors']);
      else if (f.dragonPungs.length === 2) P('Two Dragon Pungs', 6, ['Dragon Pung', 'Pung of Terminals or Honors']);
      else if (f.dragonPungs.length === 1) P('Dragon Pung', 2, ['Pung of Terminals or Honors']);
      f.windPungs.forEach((s) => {
        if (s.t === roundT) P('Prevalent Wind', 2, ['Pung of Terminals or Honors']);
        if (s.t === seatT) P('Seat Wind', 2, ['Pung of Terminals or Honors']);
      });
      // kongs and concealed pungs
      if (kongs.length === 4) P('Four Kongs', 88, ['Three Kongs', 'All Pungs', 'Single Wait', 'Melded Kong', 'Concealed Kong', 'Two Melded Kongs', 'Two Concealed Kongs', 'Melded and Concealed Kong']);
      else if (kongs.length === 3) P('Three Kongs', 32, ['Melded Kong', 'Concealed Kong', 'Two Melded Kongs', 'Two Concealed Kongs', 'Melded and Concealed Kong']);
      const ck = kongs.filter((k) => !k.open).length;
      const mk = kongs.length - ck;
      if (ck === 2) P('Two Concealed Kongs', 8, ['Concealed Kong']);
      else if (mk === 2) P('Two Melded Kongs', 4, ['Melded Kong']);
      else if (ck === 1 && mk === 1) P('Melded and Concealed Kong', 5, ['Melded Kong', 'Concealed Kong']);
      P('Concealed Kong', 2, [], ck);
      P('Melded Kong', 1, [], mk);
      const cp = f.concealedPungs.length;
      if (cp === 4) P('Four Concealed Pungs', 64, ['All Pungs', 'Concealed Hand', 'Three Concealed Pungs', 'Two Concealed Pungs']);
      else if (cp === 3) P('Three Concealed Pungs', 16, ['Two Concealed Pungs']);
      else if (cp === 2) P('Two Concealed Pungs', 2);
      if (pungs.length === 4) P('All Pungs', 6);
      // pung combinations
      if (hasSanshokuPung(pungs)) P('Triple Pung', 16, ['Double Pung']);
      else {
        let dp = 0;
        for (let n = 0; n < 9; n++) {
          const have = [0, 1, 2].filter((s) => pungs.some((p) => p.t === s * 9 + n)).length;
          if (have >= 2) dp++;
        }
        P('Double Pung', 2, [], Math.min(dp, 2));
      }
      const pk = pungs.filter((p) => p.t < 27).sort((a, b) => a.t - b.t);
      const pairSuits = (a, b, c) => pk.some((x) => pk.some((y) => y.t === x.t + a && H.suitOf(y.t) === H.suitOf(x.t)));
      for (let s = 0; s < 3; s++) {
        const ps = pk.filter((p) => H.suitOf(p.t) === s).map((p) => p.t);
        for (const t of ps) {
          if (ps.includes(t + 1) && ps.includes(t + 2) && ps.includes(t + 3)) P('Four Pure Shifted Pungs', 48, ['Pure Shifted Pungs', 'All Pungs']);
          else if (ps.includes(t + 1) && ps.includes(t + 2) && !(ps.includes(t + 3))) P('Pure Shifted Pungs', 24, []);
        }
      }
      // mixed shifted pungs
      const mixedShift = (arr) => {
        for (const a of arr) {
          for (const b of arr) {
            for (const c of arr) {
              const s = [H.suitOf(a.t), H.suitOf(b.t), H.suitOf(c.t)];
              if (new Set(s).size === 3 && b.t % 9 === (a.t % 9) + 1 && c.t % 9 === (b.t % 9) + 1) return true;
            }
          }
        }
        return false;
      };
      if (mixedShift(pk) && !hasSanshokuPung(pungs)) P('Mixed Shifted Pungs', 8);
      const thPungs = pungs.filter((s) => H.isTH(s.t) && !(H.isDragon(s.t)) && s.t !== roundT && s.t !== seatT);
      P('Pung of Terminals or Honors', 1, [], thPungs.length);

      // chow combinations
      const chowTs = chows.map((c) => c.t);
      const quad = Object.values(chowTs.reduce((m, t) => { m[t] = (m[t] || 0) + 1; return m; }, {})).some((n) => n === 4);
      const triple = Object.values(chowTs.reduce((m, t) => { m[t] = (m[t] || 0) + 1; return m; }, {})).some((n) => n >= 3);
      if (quad) P('Quadruple Chow', 48, ['Pure Triple Chow', 'Pure Double Chow', 'Tile Hog']);
      else if (triple) P('Pure Triple Chow', 24, ['Pure Double Chow']);
      let pureDouble = triple || quad ? 0 : countPairs(chowTs);
      // four pure shifted chows / pure shifted chows
      let shifted4 = false;
      let shifted3 = false;
      for (let s = 0; s < 3; s++) {
        const cs = chows.filter((c) => H.suitOf(c.t) === s).map((c) => c.t % 9);
        for (const step of [1, 2]) {
          for (let a = 0; a + 3 * step <= 6; a++) {
            if ([0, 1, 2, 3].every((i) => cs.includes(a + i * step))) shifted4 = true;
          }
          for (let a = 0; a + 2 * step <= 6; a++) {
            if ([0, 1, 2].every((i) => cs.includes(a + i * step))) shifted3 = true;
          }
        }
      }
      const pureStraight = hasIttsu(chows);
      if (shifted4) P('Four Pure Shifted Chows', 32, ['Pure Shifted Chows', 'Short Straight', 'Pure Double Chow']);
      else if (shifted3 && !pureStraight) P('Pure Shifted Chows', 16, ['Short Straight']);
      if (pureStraight) P('Pure Straight', 16, ['Short Straight', 'Two Terminal Chows']);
      if (hasSanshokuChow(chows)) P('Mixed Triple Chow', 8, ['Mixed Double Chow']);
      // mixed straight: 123, 456, 789 in three different suits
      let mixedStraight = false;
      for (const a of chows) {
        for (const b of chows) {
          for (const c of chows) {
            if (a.t % 9 === 0 && b.t % 9 === 3 && c.t % 9 === 6 && new Set([H.suitOf(a.t), H.suitOf(b.t), H.suitOf(c.t)]).size === 3) mixedStraight = true;
          }
        }
      }
      if (mixedStraight && !pureStraight) P('Mixed Straight', 8, []);
      // mixed shifted chows
      let mixedShifted = false;
      for (const a of chows) {
        for (const b of chows) {
          for (const c of chows) {
            const n = [a.t % 9, b.t % 9, c.t % 9];
            if (new Set([H.suitOf(a.t), H.suitOf(b.t), H.suitOf(c.t)]).size === 3 && n[1] === n[0] + 1 && n[2] === n[1] + 1) mixedShifted = true;
          }
        }
      }
      if (mixedShifted && !hasSanshokuChow(chows)) P('Mixed Shifted Chows', 6);
      // terminal chows
      const termChowSuits = [0, 1, 2].filter((s) => chows.some((c) => c.t === s * 9) && chows.some((c) => c.t === s * 9 + 6));
      if (chows.length === 4 && f.suits.size === 1 && !f.hasHonor && termChowSuits.length === 1 && chowTs.filter((t) => t % 9 === 0).length === 2 && chowTs.filter((t) => t % 9 === 6).length === 2 && I.pair % 9 === 4) P('Pure Terminal Chows', 64, ['Full Flush', 'All Chows', 'Pure Double Chow', 'Two Terminal Chows', 'No Honors', 'One Voided Suit']);
      else if (chows.length === 4 && termChowSuits.length >= 2 && I.pair < 27 && I.pair % 9 === 4 && !termChowSuits.includes(H.suitOf(I.pair)) && chowTs.filter((t) => t % 9 === 0).length === 2) P('Three-Suited Terminal Chows', 16, ['All Chows', 'No Honors', 'Mixed Double Chow']);
      else P('Two Terminal Chows', 1, [], Math.min(termChowSuits.length, 2));
      if (!shifted3 && !pureStraight && !shifted4) {
        // short straight: two consecutive-by-3 chows in one suit
        let ss = 0;
        for (let s = 0; s < 3; s++) {
          const cs = chows.filter((c) => H.suitOf(c.t) === s).map((c) => c.t % 9);
          for (let a = 0; a <= 3; a++) if (cs.includes(a) && cs.includes(a + 3)) ss++;
        }
        P('Short Straight', 1, [], Math.min(ss, 2));
      }
      P('Pure Double Chow', 1, [], Math.min(pureDouble, 2));
      // mixed double chow
      let md = 0;
      for (let n = 0; n <= 6; n++) {
        const have = [0, 1, 2].filter((s) => chows.some((c) => c.t === s * 9 + n)).length;
        if (have === 2 && !hasSanshokuChow(chows)) md++;
      }
      P('Mixed Double Chow', 1, [], Math.min(md, 2));
      if (chows.length === 4 && !f.hasHonor) P('All Chows', 2);
      // tile hog
      let hog = 0;
      cnt.forEach((n, t) => { if (n === 4 && !kongs.some((k) => k.t === t)) hog++; });
      P('Tile Hog', 2, [], hog);
      // all even pungs and similar
      if (pungs.length === 4 && all.every((t) => t < 27 && (t % 9) % 2 === 1)) P('All Even Pungs', 24, ['All Pungs', 'All Simples', 'No Honors']);
      if (sets.concat([{ k: 'pair', t: I.pair }]).every((s) => H.setTiles(s.k === 'pair' ? { k: 'pung', t: s.t } : s).some((t) => t < 27 && t % 9 === 4))) P('All Fives', 16, ['All Simples', 'No Honors']);
      // outside hand
      const eachTH = sets.every((s) => (s.k === 'chow' ? s.t % 9 === 0 || s.t % 9 === 6 : H.isTH(s.t))) && H.isTH(I.pair);
      if (eachTH && !all.every(H.isTH)) P('Outside Hand', 4);
      // melded hand
      if (sets.every((s) => s.open) && I.wait === 'tanki' && !tsumo) P('Melded Hand', 6, ['Single Wait']);
      // all types
      if (f.suits.size === 3 && all.some(H.isWind) && all.some(H.isDragon)) P('All Types', 6);
      // waits
      if (I.wait === 'penchan') P('Edge Wait', 1);
      if (I.wait === 'kanchan') P('Closed Wait', 1);
      if (I.wait === 'tanki') P('Single Wait', 1);
      if (!concealedHand || true) { /* concealed handled below */ }
    }
    // tile-set patterns usable for any structure
    if (all.every(H.isHonor)) P('All Honors', 64, ['All Pungs', 'Outside Hand', 'Pung of Terminals or Honors', 'All Types', 'Half Flush', 'One Voided Suit']);
    else if (all.every(H.isTerm)) P('All Terminals', 64, ['All Pungs', 'Outside Hand', 'Pung of Terminals or Honors', 'Double Pung', 'No Honors', 'Mixed Double Chow']);
    else if (all.every(H.isTH)) P('All Terminals and Honors', 32, ['All Pungs', 'Outside Hand', 'Pung of Terminals or Honors', 'Double Pung']);
    if (all.every((t) => GREEN.includes(t))) P('All Green', 88, ['Half Flush', 'One Voided Suit']);
    if (f.oneSuit && !f.hasHonor) P('Full Flush', 24, ['One Voided Suit', 'No Honors']);
    else if (f.oneSuit && f.hasHonor) P('Half Flush', 6, ['One Voided Suit']);
    else if (f.suits.size === 2 && !f.hasHonor) P('One Voided Suit', 1);
    else if (f.suits.size === 2) P('One Voided Suit', 1);
    if (!f.hasHonor && !(f.oneSuit)) P('No Honors', 1);
    if (!f.hasHonor && all.every(H.isSimple)) P('All Simples', 2, ['No Honors']);
    if (!f.hasHonor) {
      if (nums.every((n) => n >= 7)) P('Upper Tiles', 24, ['Upper Four', 'No Honors']);
      else if (nums.every((n) => n >= 6)) P('Upper Four', 12, ['No Honors']);
      if (nums.every((n) => n >= 4 && n <= 6)) P('Middle Tiles', 24, ['All Simples', 'No Honors']);
      if (nums.every((n) => n <= 3)) P('Lower Tiles', 24, ['Lower Four', 'No Honors']);
      else if (nums.every((n) => n <= 4)) P('Lower Four', 12, ['No Honors']);
    }
    // reversible tiles: 1234589 circles, 245689 bamboo, white dragon
    const REV = [9, 10, 11, 12, 13, 16, 17, 19, 21, 22, 23, 25, 26, 31];
    if (all.every((t) => REV.includes(t))) P('Reversible Tiles', 8, ['One Voided Suit']);
    // nine gates
    if (f.standard && !f.openAny && f.oneSuit && !f.hasHonor && all.length === 14) {
      const base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      const c = new Array(9).fill(0);
      all.forEach((t) => c[t % 9]++);
      if (c.every((n, i) => n >= base[i])) P('Nine Gates', 88, ['Full Flush', 'Concealed Hand', 'No Honors', 'One Voided Suit', 'Pung of Terminals or Honors', 'All Pungs']);
    }
    // hand state and winning conditions
    if (!f.openAny) {
      if (tsumo && concealedHand) P('Fully Concealed Hand', 4, ['Self-Drawn', 'Concealed Hand']);
      else if (!tsumo) P('Concealed Hand', 2);
    }
    if (fl.lastWall && tsumo) P('Last Tile Draw', 8, ['Self-Drawn']);
    if (fl.lastDiscard && !tsumo) P('Last Tile Claim', 8);
    if (fl.kongDraw && tsumo) P('Out with Replacement Tile', 8, ['Self-Drawn']);
    if (fl.robKong && !tsumo) P('Robbing the Kong', 8, ['Last Tile']);
    if (fl.fourthTile) P('Last Tile', 4);
    if (tsumo) P('Self-Drawn', 1);

    // select patterns highest-first, applying exclusions
    cands.sort((a, b) => b.v - a.v);
    const excluded = new Set();
    const chosen = [];
    for (const c of cands) {
      if (excluded.has(c.label)) continue;
      chosen.push(c);
      c.ex.forEach((x) => excluded.add(x));
    }
    // dedupe (several candidate loops may repeat a pattern)
    const seen = new Set();
    const uniq = chosen.filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true)));
    let fan = uniq.reduce((a, c) => a + c.v * c.n, 0);
    if (uniq.length === 0 && f.standard) uniq.push({ label: 'Chicken Hand', v: 8, n: 1 }), (fan = 8);
    const patterns = uniq.map((c) => ({ label: c.label + (c.n > 1 ? ' ×' + c.n : ''), value: c.v * c.n + ' pts' }));
    if (fs.total) patterns.push({ label: 'Flower tiles ×' + fs.total, value: fs.total + ' pts (not counted toward the minimum)' });
    const score = M.mcrScore({ fan, flowers: fs.total, selfDraw: tsumo, min: opt.min == null ? 8 : opt.min });
    return { patterns, fan, score, rank: score.ok ? score.total : -1 };
  }

  /* ───────── dispatcher ───────── */

  const RULESETS = {
    riichi: { sets: 4, eval: riichiEval },
    hk: { sets: 4, eval: hkEval },
    cn: { sets: 4, eval: cnEval },
    cc: { sets: 4, eval: ccEval },
    tw: { sets: 5, eval: twEval },
    mcr: { sets: 4, eval: mcrEval },
  };

  /* ───────── situation checks ───────── */

  const FLAG_SETS = {
    riichi: 'riichi', dblRiichi: 'riichi', ippatsu: 'riichi',
    lastWall: 'riichi hk mcr cn cc tw', lastDiscard: 'riichi hk mcr cn cc', kongDraw: 'riichi hk mcr cn cc',
    robKong: 'riichi hk mcr cn cc tw', heavenly: 'riichi hk cc tw', earthly: 'riichi hk cc tw',
    fourthTile: 'mcr cn', doubleKong: 'hk', early: 'tw', early2: 'tw', readyOriginal: 'cc tw',
  };
  function activeFlags(ruleset, flags) {
    const out = {};
    Object.keys(flags || {}).forEach((k) => {
      if (flags[k] && FLAG_SETS[k] && FLAG_SETS[k].split(' ').includes(ruleset)) out[k] = true;
    });
    return out;
  }
  /* Contradictions between the ticks, the seat, self-draw and the hand. hand is optional. */
  function conflicts(ruleset, hand, ctx) {
    const f = activeFlags(ruleset, ctx.flags);
    const tsumo = !!ctx.tsumo;
    const dealer = ctx.seat === 0;
    const out = [];
    const bad = (m) => out.push(m);
    if (f.heavenly && f.earthly) bad('Heavenly hand and earthly hand cannot both be ticked.');
    if (f.heavenly) {
      if (!dealer) bad('Heavenly hand is for the dealer: set the seat to East.');
      if (!tsumo) bad('Heavenly hand is a self-drawn win: tick Self-drawn.');
    }
    if (f.earthly) {
      if (dealer) bad('Earthly hand is for a non-dealer: change the seat from East.');
      if (ruleset === 'riichi' && !tsumo) bad('Earthly hand (chiihou) is a self-drawn win: tick Self-drawn.');
      if (ruleset !== 'riichi' && tsumo) bad('Earthly hand is a win on a discard: untick Self-drawn.');
    }
    if (f.heavenly || f.earthly) {
      const others = { riichi: 'Riichi', dblRiichi: 'Double riichi', ippatsu: 'Ippatsu', lastWall: 'Last tile of wall', lastDiscard: 'Last discard', kongDraw: 'After a kong', robKong: 'Robbing a kong', doubleKong: 'Double kong win', early: 'Early win', early2: 'Early win' };
      Object.keys(others).forEach((k) => { if (f[k]) bad((f.heavenly ? 'Heavenly' : 'Earthly') + ' hand cannot be combined with "' + others[k] + '".'); });
    }
    if (f.ippatsu && !f.riichi && !f.dblRiichi) bad('Ippatsu needs riichi or double riichi.');
    if (f.lastWall && !tsumo) bad('"Last tile of wall" is a self-drawn win: tick Self-drawn.');
    if (f.lastDiscard && tsumo) bad('"Last discard" is a win on a discard: untick Self-drawn.');
    if (f.lastWall && f.lastDiscard) bad('"Last tile of wall" and "Last discard" cannot both be ticked.');
    if (f.kongDraw && !tsumo) bad('"After a kong" is a self-drawn win: tick Self-drawn.');
    if (f.doubleKong && !tsumo) bad('"Double kong win" is a self-drawn win: tick Self-drawn.');
    if (f.robKong && tsumo) bad('"Robbing a kong" is a win on a discard: untick Self-drawn.');
    if (f.robKong && f.lastDiscard) bad('"Robbing a kong" and "Last discard" cannot both be ticked.');
    if (f.kongDraw && f.robKong) bad('"After a kong" and "Robbing a kong" cannot both be ticked.');
    if (ruleset === 'riichi' && f.kongDraw && f.lastWall) bad('A win on a kong replacement tile cannot also be a last-tile-of-wall win.');
    if (f.early && f.early2) bad('Only one early-win tick can be used.');
    if (hand) {
      const melds = hand.melds || [];
      const kongs = melds.filter((m) => m.k === 'kong').length + (hand.closed ? Object.values(hand.closed.reduce((c, t) => { c[t] = (c[t] || 0) + 1; return c; }, {})).filter((n) => n === 4).length : 0);
      if ((f.riichi || f.dblRiichi) && melds.some((m) => m.open)) bad('Riichi needs a closed hand: untick riichi or the called set.');
      if (f.kongDraw && kongs < 1) bad('"After a kong" needs a kong in the hand.');
      if (f.doubleKong && kongs < 2) bad('"Double kong win" needs at least two kongs in the hand.');
    }
    return out;
  }

  function analyze(ruleset, hand, ctx, opt = {}) {
    const R = RULESETS[ruleset];
    const err = H.check(hand, R.sets);
    if (err) return { ok: false, error: err };
    ctx = Object.assign({}, ctx, { flags: activeFlags(ruleset, ctx.flags) });
    const cf = conflicts(ruleset, hand, ctx);
    if (cf.length) return { ok: false, error: cf.join(' ') };
    const interps = H.interpretations(hand, { setsTotal: R.sets, tsumo: !!ctx.tsumo });
    if (!interps.length) return { ok: false, error: 'This is not a complete winning hand.' };
    const waitCount = ruleset === 'cc' ? H.waitingTiles(hand, { setsTotal: R.sets, tsumo: false }).length : 0;
    let best = null;
    let firstError = null;
    for (const I of interps) {
      const r = R.eval(I, hand, ctx, opt, waitCount);
      r.I = I;
      r.I = I;
      if (r.error && !firstError) firstError = r.error;
      if (!best || r.rank > best.rank) best = r;
    }
    if (!best || best.rank < 0) {
      const sc = best && best.score && !best.score.ok ? best.score.error : null;
      return { ok: false, error: firstError || sc || 'This hand does not score.', patterns: best ? best.patterns : [], interp: best ? best.I : null };
    }
    return { ok: true, patterns: best.patterns, score: best.score, detail: best, interp: best.I };
  }

  const api = { analyze, conflicts, FLAG_SETS, riichiEval, hkEval, cnEval, ccEval, twEval, mcrEval, info };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MahjongRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
