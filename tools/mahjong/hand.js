/* Tile engine: notation parsing, hand decomposition, winning-tile placements.
 * Tiles are indexes 0-33: 0-8 characters (m), 9-17 circles (p), 18-26 bamboo (s),
 * 27-30 winds E S W N, 31-33 dragons White Green Red. */
(function (root) {
  'use strict';

  const suitOf = (t) => (t < 27 ? Math.floor(t / 9) : 3);
  const numOf = (t) => (t % 9) + 1; // suit tiles only
  const isHonor = (t) => t >= 27;
  const isWind = (t) => t >= 27 && t <= 30;
  const isDragon = (t) => t >= 31;
  const isTerm = (t) => t < 27 && (t % 9 === 0 || t % 9 === 8);
  const isTH = (t) => isHonor(t) || isTerm(t);
  const isSimple = (t) => t < 27 && !isTerm(t);

  const HONOR_NAMES = ['East', 'South', 'West', 'North', 'White', 'Green', 'Red'];
  const SUIT_LETTERS = ['m', 'p', 's'];
  const tileName = (t) => (t >= 27 ? HONOR_NAMES[t - 27] : numOf(t) + SUIT_LETTERS[suitOf(t)]);

  /** "123m456p77z" -> { tiles, reds }. 0 = red five. Throws on bad input. */
  function parse(str) {
    const tiles = [];
    let reds = 0;
    let buf = [];
    for (const ch of String(str).replace(/\s+/g, '')) {
      if (/[0-9]/.test(ch)) buf.push(+ch);
      else if ('mpsz'.includes(ch)) {
        if (!buf.length) throw new Error('Suit letter "' + ch + '" has no digits before it');
        const base = { m: 0, p: 9, s: 18, z: 27 }[ch];
        for (const d of buf) {
          if (ch === 'z') {
            if (d < 1 || d > 7) throw new Error('Honors are 1z-7z');
            tiles.push(27 + d - 1);
          } else if (d === 0) { reds++; tiles.push(base + 4); } else tiles.push(base + d - 1);
        }
        buf = [];
      } else throw new Error('Unexpected "' + ch + '"');
    }
    if (buf.length) throw new Error('Digits need a suit letter (m, p, s or z)');
    return { tiles, reds };
  }

  /** Inverse of parse (no reds). */
  function format(tiles) {
    const groups = [[], [], [], []];
    for (const t of tiles.slice().sort((a, b) => a - b)) groups[suitOf(t)].push(t < 27 ? numOf(t) : t - 26);
    return groups.map((g, i) => (g.length ? g.join('') + 'mpsz'[i] : '')).join('');
  }

  const counts = (tiles) => { const c = new Array(34).fill(0); for (const t of tiles) c[t]++; return c; };

  const setTiles = (s) => (s.k === 'chow' ? [s.t, s.t + 1, s.t + 2] : s.k === 'pung' ? [s.t, s.t, s.t] : [s.t, s.t, s.t, s.t]);

  /** Every tile used by an interpretation (kongs count 4). */
  function tilesOf(I) {
    if (I.special === 'chiitoi') return I.pairs.flatMap((p) => [p, p]);
    if (I.special) return I.tiles;
    return I.sets.flatMap(setTiles).concat([I.pair, I.pair]);
  }

  /** All ways to split closed tiles into `need` sets (chows/pungs) plus a pair. */
  function decompose(cnt, need) {
    const res = [];
    const c = cnt.slice();
    const rec = (i, sets, pair) => {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) {
        if (sets.length === need && pair !== null) res.push({ sets: sets.slice(), pair });
        return;
      }
      if (sets.length > need) return;
      if (c[i] >= 3) { c[i] -= 3; sets.push({ k: 'pung', t: i }); rec(i, sets, pair); sets.pop(); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ k: 'chow', t: i });
        rec(i, sets, pair);
        sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
      }
      if (pair === null && c[i] >= 2) { c[i] -= 2; rec(i, sets, i); c[i] += 2; }
    };
    rec(0, [], null);
    return res;
  }

  function chowWait(t, w) {
    if (w === t + 1) return 'kanchan';
    if ((w === t && t % 9 === 6) || (w === t + 2 && t % 9 === 0)) return 'penchan';
    return 'ryanmen';
  }

  const TH_TILES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

  /**
   * hand = { closed: [tiles incl. winning tile], melds: [{k:'chow'|'pung'|'kong', t, open}], win }
   * opts = { setsTotal: 4 | 5, tsumo }
   * Returns every valid reading: standard (sets + pair, with the placement of the winning tile),
   * seven pairs, thirteen orphans, and (5 sets) seven pairs and a triplet.
   */
  function interpretations(hand, { setsTotal = 4, tsumo = false } = {}) {
    const { closed, melds = [], win } = hand;
    const cnt = counts(closed);
    const out = [];
    const seen = new Set();
    const meldSets = melds.map((m) => ({ k: m.k, t: m.t, open: !!m.open }));
    const sig = (s) => s.k + s.t + (s.open ? 'o' : '') + (s.ron ? 'r' : '');
    const need = setsTotal - melds.length;

    if (need >= 0) {
      for (const d of decompose(cnt, need)) {
        const place = (i, wait) => {
          const sets = meldSets.concat(d.sets.map((s, j) => ({ k: s.k, t: s.t, open: false, ron: j === i && s.k === 'pung' && !tsumo })));
          const winIdx = i < 0 ? -1 : meldSets.length + i;
          const key = [sets.map(sig).sort().join(','), d.pair, wait, winIdx < 0 ? 'p' : sig(sets[winIdx])].join('|');
          if (seen.has(key)) return;
          seen.add(key);
          out.push({ sets, pair: d.pair, wait, winIdx });
        };
        d.sets.forEach((s, i) => {
          if (s.k === 'pung' && s.t === win) place(i, 'shanpon');
          if (s.k === 'chow' && win >= s.t && win <= s.t + 2) place(i, chowWait(s.t, win));
        });
        if (d.pair === win) place(-1, 'tanki');
      }
    }

    if (melds.length === 0) {
      if (setsTotal === 4 && closed.length === 14) {
        if (cnt.every((n) => n === 0 || n === 2 || n === 4)) {
          const pairs = [];
          cnt.forEach((n, t) => { for (let i = 0; i < n / 2; i++) pairs.push(t); });
          if (pairs.length === 7 && cnt[win] > 0) out.push({ special: 'chiitoi', pairs, dup: cnt.some((n) => n === 4), wait: 'tanki', sets: [], tiles: closed.slice() });
        }
        if (TH_TILES.every((t) => cnt[t] >= 1) && closed.every((t) => TH_TILES.includes(t))) {
          out.push({ special: 'kokushi', thirteenWait: cnt[win] === 2, wait: 'tanki', sets: [], tiles: closed.slice() });
        }
      }
      if (setsTotal === 5 && closed.length === 17) {
        const odd = cnt.filter((n) => n % 2 === 1);
        if (odd.length === 1 && odd[0] === 3 && cnt.every((n) => n < 5)) {
          out.push({ special: 'pairs17', wait: 'tanki', sets: [], tiles: closed.slice() });
        }
      }
    }
    return out;
  }

  /** Validation: returns an error message or null. */
  function check(hand, setsTotal) {
    const { closed, melds = [], win } = hand;
    const want = (setsTotal - melds.length) * 3 + 2;
    if (closed.length !== want) return 'Need ' + want + ' concealed tiles including the winning tile (you have ' + closed.length + ').';
    if (!closed.includes(win)) return 'Pick the winning tile from your concealed tiles.';
    const used = counts(closed);
    for (const m of melds) for (const t of setTiles(m)) used[t]++;
    const bad = used.findIndex((n) => n > 4);
    if (bad >= 0) return 'There are more than four ' + tileName(bad) + ' tiles.';
    return null;
  }

  /** Distinct tiles that would complete the hand without the winning tile (for one-chance detection). */
  function waitingTiles(hand, opts) {
    const base = hand.closed.slice();
    const i = base.indexOf(hand.win);
    if (i < 0) return [];
    base.splice(i, 1);
    const used = counts(base);
    for (const m of hand.melds || []) for (const t of setTiles(m)) used[t]++;
    const res = [];
    for (let c = 0; c < 34; c++) {
      if (used[c] >= 4) continue;
      if (interpretations({ closed: base.concat([c]), melds: hand.melds, win: c }, opts).length) res.push(c);
    }
    return res;
  }

  const api = { suitOf, numOf, isHonor, isWind, isDragon, isTerm, isTH, isSimple, tileName, parse, format, counts, setTiles, tilesOf, decompose, interpretations, check, waitingTiles, TH_TILES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MahjongHand = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
