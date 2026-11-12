/* Mahjong scoring engine: Riichi, Chinese Official (MCR), Hong Kong, Taiwanese.
 * Pure functions, no DOM. Works in browsers (window.Mahjong) and Node (require). */
(function (root) {
  'use strict';

  const ceil100 = (n) => Math.ceil(n / 100) * 100;

  /* ───────────────────────── Riichi ───────────────────────── */

  // c = han when closed, o = han when open (0 = not allowed open), y = yakuman
  const RIICHI_YAKU = [
    { id: 'riichi', g: '1 han', label: 'Riichi', c: 1, o: 0 },
    { id: 'ippatsu', g: '1 han', label: 'Ippatsu', c: 1, o: 0 },
    { id: 'pinfu', g: '1 han', label: 'Pinfu', c: 1, o: 0 },
    { id: 'iipeikou', g: '1 han', label: 'Iipeikou', c: 1, o: 0 },
    { id: 'tanyao', g: '1 han', label: 'Tanyao', c: 1, o: 1 },
    { id: 'haku', g: '1 han', label: 'Yakuhai: white dragon', c: 1, o: 1 },
    { id: 'hatsu', g: '1 han', label: 'Yakuhai: green dragon', c: 1, o: 1 },
    { id: 'chun', g: '1 han', label: 'Yakuhai: red dragon', c: 1, o: 1 },
    { id: 'seatwind', g: '1 han', label: 'Yakuhai: seat wind', c: 1, o: 1 },
    { id: 'roundwind', g: '1 han', label: 'Yakuhai: round wind', c: 1, o: 1 },
    { id: 'haitei', g: '1 han', label: 'Haitei / Houtei', c: 1, o: 1 },
    { id: 'rinshan', g: '1 han', label: 'Rinshan kaihou', c: 1, o: 1 },
    { id: 'chankan', g: '1 han', label: 'Chankan', c: 1, o: 1 },
    { id: 'dblriichi', g: '2 han', label: 'Double riichi', c: 2, o: 0 },
    { id: 'chiitoi', g: '2 han', label: 'Chiitoitsu', c: 2, o: 0 },
    { id: 'sanshokuD', g: '2 han', label: 'Sanshoku doujun', c: 2, o: 1 },
    { id: 'ittsu', g: '2 han', label: 'Ittsu', c: 2, o: 1 },
    { id: 'chanta', g: '2 han', label: 'Chanta', c: 2, o: 1 },
    { id: 'toitoi', g: '2 han', label: 'Toitoi', c: 2, o: 2 },
    { id: 'sanankou', g: '2 han', label: 'Sanankou', c: 2, o: 2 },
    { id: 'sanshokuK', g: '2 han', label: 'Sanshoku doukou', c: 2, o: 2 },
    { id: 'sankantsu', g: '2 han', label: 'Sankantsu', c: 2, o: 2 },
    { id: 'shousangen', g: '2 han', label: 'Shousangen', c: 2, o: 2 },
    { id: 'honroutou', g: '2 han', label: 'Honroutou', c: 2, o: 2 },
    { id: 'honitsu', g: '3 han', label: 'Honitsu', c: 3, o: 2 },
    { id: 'junchan', g: '3 han', label: 'Junchan', c: 3, o: 2 },
    { id: 'ryanpeikou', g: '3 han', label: 'Ryanpeikou', c: 3, o: 0 },
    { id: 'chinitsu', g: '6 han', label: 'Chinitsu', c: 6, o: 5 },
    { id: 'kokushi', g: 'Yakuman', label: 'Kokushi musou', y: 1 },
    { id: 'suuankou', g: 'Yakuman', label: 'Suuankou', y: 1 },
    { id: 'daisangen', g: 'Yakuman', label: 'Daisangen', y: 1 },
    { id: 'shousuushii', g: 'Yakuman', label: 'Shousuushii', y: 1 },
    { id: 'daisuushii', g: 'Yakuman', label: 'Daisuushii', y: 1 },
    { id: 'tsuuiisou', g: 'Yakuman', label: 'Tsuuiisou', y: 1 },
    { id: 'chinroutou', g: 'Yakuman', label: 'Chinroutou', y: 1 },
    { id: 'ryuuiisou', g: 'Yakuman', label: 'Ryuuiisou', y: 1 },
    { id: 'chuuren', g: 'Yakuman', label: 'Chuuren poutou', y: 1 },
    { id: 'suukantsu', g: 'Yakuman', label: 'Suukantsu', y: 1 },
    { id: 'tenhou', g: 'Yakuman', label: 'Tenhou', y: 1 },
    { id: 'chiihou', g: 'Yakuman', label: 'Chiihou', y: 1 },
  ];

  // Fu per meld type. s/t = simple / terminal-or-honor, o/c = open / concealed.
  const RIICHI_MELD_FU = {
    seq: 0,
    tri_s_o: 2, tri_s_c: 4, tri_t_o: 4, tri_t_c: 8,
    kan_s_o: 8, kan_s_c: 16, kan_t_o: 16, kan_t_c: 32,
  };

  function riichiHan({ sel = {}, open = false, tsumo = false, dora = 0, ura = 0, aka = 0, extraYakuman = 0 }) {
    let yaku = 0;
    let yakuman = extraYakuman;
    for (const y of RIICHI_YAKU) {
      if (!sel[y.id]) continue;
      if (y.y) yakuman += 1;
      else yaku += open ? y.o : y.c;
    }
    if (!open && tsumo) yaku += 1; // menzen tsumo
    const bonus = dora + ura + aka;
    return { yaku, bonus, han: yaku > 0 ? yaku + bonus : 0, yakuman };
  }

  function riichiFu({ tsumo = false, open = false, melds = [], pair = 0, wait = false, pinfu = false, chiitoi = false }) {
    if (chiitoi) return 25;
    if (pinfu) return tsumo ? 20 : 30;
    let fu = 20;
    if (!open && !tsumo) fu += 10;
    if (tsumo) fu += 2;
    for (const m of melds) fu += RIICHI_MELD_FU[m] || 0;
    fu += pair + (wait ? 2 : 0);
    if (open && !tsumo && fu === 20) fu = 30; // open "pinfu" shape still scores 30 on ron
    return Math.ceil(fu / 10) * 10;
  }

  function riichiBasic(han, fu, { yakuman = 0, kazoe = true, kiriage = false } = {}) {
    if (yakuman > 0) return { basic: 8000 * yakuman, name: yakuman === 1 ? 'Yakuman' : yakuman + '× Yakuman' };
    if (han >= 13) return kazoe ? { basic: 8000, name: 'Kazoe yakuman' } : { basic: 6000, name: 'Sanbaiman' };
    if (han >= 11) return { basic: 6000, name: 'Sanbaiman' };
    if (han >= 8) return { basic: 4000, name: 'Baiman' };
    if (han >= 6) return { basic: 3000, name: 'Haneman' };
    if (han >= 5) return { basic: 2000, name: 'Mangan' };
    const b = fu * Math.pow(2, han + 2);
    if (b > 2000 || (kiriage && b >= 1920)) return { basic: 2000, name: 'Mangan' };
    return { basic: b, name: '' };
  }

  function riichiScore({ han, fu, yakuman = 0, dealer = false, tsumo = false, honba = 0, sticks = 0, kazoe = true, kiriage = false }) {
    if (!yakuman && han < 1) return { ok: false, error: 'No yaku: a hand needs at least 1 han from a yaku.' };
    const { basic, name } = riichiBasic(han, fu, { yakuman, kazoe, kiriage });
    const lines = [];
    let total;
    if (tsumo) {
      if (dealer) {
        const each = ceil100(basic * 2) + 100 * honba;
        lines.push({ label: 'Each of 3 players pays', amount: each, count: 3 });
        total = each * 3;
      } else {
        const d = ceil100(basic * 2) + 100 * honba;
        const o = ceil100(basic) + 100 * honba;
        lines.push({ label: 'Dealer pays', amount: d, count: 1 });
        lines.push({ label: 'Each other player pays', amount: o, count: 2 });
        total = d + o * 2;
      }
    } else {
      const a = ceil100(basic * (dealer ? 6 : 4)) + 300 * honba;
      lines.push({ label: 'Discarder pays', amount: a, count: 1 });
      total = a;
    }
    if (sticks) {
      lines.push({ label: 'Riichi sticks collected', amount: 1000 * sticks, count: 1, extra: true });
      total += 1000 * sticks;
    }
    return {
      ok: true,
      headline: name || (han + ' han ' + fu + ' fu'),
      sub: yakuman ? '' : han + ' han · ' + fu + ' fu · basic points ' + basic,
      lines, total,
    };
  }

  /* ───────────── Chinese Official (MCR) ───────────── */

  // [id, label, points, max]
  const MCR_PATTERNS = [
    ['88', 'Big Four Winds', 88], ['88', 'Big Three Dragons', 88], ['88', 'All Green', 88],
    ['88', 'Nine Gates', 88], ['88', 'Four Kongs', 88], ['88', 'Seven Shifted Pairs', 88],
    ['88', 'Thirteen Orphans', 88],
    ['64', 'All Terminals', 64], ['64', 'Little Four Winds', 64], ['64', 'Little Three Dragons', 64],
    ['64', 'All Honors', 64], ['64', 'Four Concealed Pungs', 64], ['64', 'Pure Terminal Chows', 64],
    ['48', 'Quadruple Chow', 48], ['48', 'Four Pure Shifted Pungs', 48],
    ['32', 'Four Pure Shifted Chows', 32], ['32', 'Three Kongs', 32], ['32', 'All Terminals and Honors', 32],
    ['24', 'Seven Pairs', 24], ['24', 'Greater Honors and Knitted Tiles', 24], ['24', 'All Even Pungs', 24],
    ['24', 'Full Flush', 24], ['24', 'Pure Triple Chow', 24], ['24', 'Pure Shifted Pungs', 24],
    ['24', 'Upper Tiles', 24], ['24', 'Middle Tiles', 24], ['24', 'Lower Tiles', 24],
    ['16', 'Pure Straight', 16], ['16', 'Three-Suited Terminal Chows', 16], ['16', 'Pure Shifted Chows', 16],
    ['16', 'All Fives', 16], ['16', 'Triple Pung', 16], ['16', 'Three Concealed Pungs', 16],
    ['12', 'Lesser Honors and Knitted Tiles', 12], ['12', 'Knitted Straight', 12], ['12', 'Upper Four', 12],
    ['12', 'Lower Four', 12], ['12', 'Big Three Winds', 12],
    ['8', 'Mixed Straight', 8], ['8', 'Reversible Tiles', 8], ['8', 'Mixed Triple Chow', 8],
    ['8', 'Mixed Shifted Pungs', 8], ['8', 'Chicken Hand', 8], ['8', 'Last Tile Draw', 8],
    ['8', 'Last Tile Claim', 8], ['8', 'Out with Replacement Tile', 8], ['8', 'Robbing the Kong', 8],
    ['6', 'All Pungs', 6], ['6', 'Half Flush', 6], ['6', 'Mixed Shifted Chows', 6],
    ['6', 'All Types', 6], ['6', 'Melded Hand', 6], ['6', 'Two Dragon Pungs', 6],
    ['5', 'Melded and Concealed Kong', 5],
    ['4', 'Outside Hand', 4], ['4', 'Fully Concealed Hand', 4], ['4', 'Two Melded Kongs', 4],
    ['4', 'Two Concealed Kongs', 4], ['4', 'Last Tile', 4],
    ['2', 'Dragon Pung', 2, 3], ['2', 'Prevalent Wind', 2], ['2', 'Seat Wind', 2], ['2', 'Concealed Hand', 2],
    ['2', 'All Chows', 2], ['2', 'Tile Hog', 2, 4], ['2', 'Double Pung', 2, 2], ['2', 'Two Concealed Pungs', 2],
    ['2', 'Concealed Kong', 2, 4], ['2', 'All Simples', 2],
    ['1', 'Pure Double Chow', 1, 2], ['1', 'Mixed Double Chow', 1, 2], ['1', 'Short Straight', 1, 2],
    ['1', 'Two Terminal Chows', 1, 2], ['1', 'Pung of Terminals or Honors', 1, 4], ['1', 'Melded Kong', 1, 4],
    ['1', 'One Voided Suit', 1], ['1', 'No Honors', 1], ['1', 'Edge Wait', 1], ['1', 'Closed Wait', 1],
    ['1', 'Single Wait', 1], ['1', 'Self-Drawn', 1], ['1', 'Flower Tile', 1, 8],
  ].map((p) => ({ id: 'mcr_' + p[1].toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''), g: p[0] + ' points', label: p[1], pts: p[2], max: p[3] || 1 }));

  // `fan` excludes flowers; flowers are added after the minimum is checked.
  function mcrScore({ fan, flowers = 0, selfDraw = false, min = 8 }) {
    if (fan < min) return { ok: false, error: 'Below the ' + min + '-point minimum (' + fan + ' without flowers).' };
    fan += flowers;
    const lines = [];
    let total;
    if (selfDraw) {
      lines.push({ label: 'Each of 3 players pays 8 + ' + fan, amount: 8 + fan, count: 3 });
      total = 3 * (8 + fan);
    } else {
      lines.push({ label: 'Discarder pays 8 + ' + fan, amount: 8 + fan, count: 1 });
      lines.push({ label: 'Each other player pays 8', amount: 8, count: 2 });
      total = 8 + fan + 16;
    }
    return { ok: true, headline: fan + ' points', sub: selfDraw ? 'Self-drawn' : 'Won on a discard', lines, total };
  }

  /* ───────────── Hong Kong ───────────── */

  const HK_HALF = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384];
  // Four Winds "Old Style" faan-laak table: total paid by a discard win (self-draw pays 1.5x); 0 faan = chicken hand
  const HK_FW = [4, 8, 16, 32, 64, 64, 64, 128, 128, 128, 256];
  const hkTable = (kind, fan) => (kind === 'full' ? Math.pow(2, fan) : kind === 'fw' ? HK_FW[Math.min(fan, 10)] : HK_HALF[fan]);

  // [group, label, faan, max]
  const HK_PATTERNS = [
    ['Hand', 'Common Hand (all sequences)', 1], ['Hand', 'All in Triplets', 3], ['Hand', 'Mixed One Suit', 3],
    ['Hand', 'All One Suit', 7], ['Hand', 'Mixed Orphans (also tick All in Triplets)', 1],
    ['Hand', 'Small Dragons (2 dragon melds also tick below)', 3],
    ['Hand', 'Great Dragons (3 dragon melds also tick below)', 5], ['Hand', 'Small Winds', 6],
    ['Hand', 'Seven Pairs (some variants)', 4],
    ['Limit hands', 'All Honor Tiles', 10], ['Limit hands', 'Self Triplets', 10], ['Limit hands', 'Orphans', 10],
    ['Limit hands', 'Nine Gates', 10], ['Limit hands', 'Great Winds', 13], ['Limit hands', 'All Kongs', 13],
    ['Limit hands', 'Thirteen Orphans', 13], ['Limit hands', 'Heavenly Hand', 13], ['Limit hands', 'Earthly Hand', 13],
    ['Winds and dragons', 'Seat wind meld', 1], ['Winds and dragons', 'Prevailing wind meld', 1],
    ['Winds and dragons', 'Dragon meld (each)', 1, 3],
    ['Flowers', 'No flowers or seasons', 1], ['Flowers', 'Flower of own seat', 1], ['Flowers', 'Season of own seat', 1],
    ['Flowers', 'All four flowers', 2], ['Flowers', 'All four seasons', 2],
    ['Special wins', 'Self-pick', 1], ['Special wins', 'Fully concealed', 1], ['Special wins', 'Robbing a Kong', 1],
    ['Special wins', 'Win by last catch', 1], ['Special wins', 'Win by Kong', 1], ['Special wins', 'Win by Double-Kong', 8],
  ].map((p) => ({ id: 'hk_' + p[1].toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''), g: p[0], label: p[1], pts: p[2], max: p[3] || 1 }));

  function hkScore({ fan, table = 'half', min = 3, limit = 13, selfDraw = false, discardPay = 'all' }) {
    const capped = Math.min(fan, limit, 13);
    if (capped < min) return { ok: false, error: 'Below the ' + min + '-faan minimum (' + fan + ' faan). Counts as a chicken hand.' };
    const T = hkTable(table, capped);
    const lines = [];
    let total;
    if (selfDraw) {
      lines.push({ label: 'Each of 3 players pays', amount: T / 2, count: 3 });
      total = T * 1.5;
    } else if (discardPay === 'half') {
      lines.push({ label: 'Discarder pays', amount: T / 2, count: 1 });
      lines.push({ label: 'Each other player pays', amount: T / 4, count: 2 });
      total = T;
    } else {
      lines.push({ label: 'Discarder pays', amount: T, count: 1 });
      total = T;
    }
    const sub = fan > capped ? fan + ' faan, capped at ' + capped : capped + ' faan';
    return { ok: true, headline: T + ' points', sub, lines, total };
  }

  /* ───────────── Taiwanese (16-tile), per Four Winds rule collection ───────────── */

  // [group, label, tai, max, solo]  (solo = special hand that replaces all other scoring)
  const TW_PATTERNS = [
    ['Flowers', 'Each flower or season', 1, 8], ['Flowers', 'No flowers or seasons', 1],
    ['Honors and kongs', 'Pung/kong of honors (each)', 1, 7], ['Honors and kongs', 'Melded kong (each)', 1, 5],
    ['Honors and kongs', 'Concealed kong (each)', 2, 5],
    ['Sets', 'Three chows of 1 suit, step 3 (melded)', 5], ['Sets', 'Three chows of 1 suit, step 3 (concealed)', 10],
    ['Sets', 'Two concealed triplets', 2], ['Sets', 'Three concealed triplets', 5],
    ['Sets', 'Four concealed triplets', 15], ['Sets', 'Five concealed triplets', 40],
    ['Sets', 'Little three dragons', 15], ['Sets', 'Little three winds', 5], ['Sets', 'Big three winds', 15],
    ['Whole hand', 'Exposed hand (single-tile wait, all melded)', 10], ['Whole hand', 'Concealed hand', 1],
    ['Whole hand', 'Fully concealed hand (self-drawn)', 3], ['Whole hand', 'Chow hand', 3],
    ['Whole hand', 'Chow hand, no honors or flowers', 10], ['Whole hand', 'Pung hand', 10],
    ['Whole hand', 'No honors', 1], ['Whole hand', 'No flowers and no honors', 3],
    ['Whole hand', 'One suit and honors', 10], ['Whole hand', 'One suit only', 40],
    ['Going out', 'Out on a one-chance chow', 1], ['Going out', 'Out on a pair', 1],
    ['Going out', 'Out on the last tile of the wall', 1], ['Going out', 'Out by robbing a kong', 1],
    ['Going out', 'Early winning (6–9 discards so far)', 5], ['Going out', 'Early winning (5 or fewer discards)', 10],
    ['Going out', 'Ready on original hand', 15],
    ['Special hands (replace everything else)', 'Seven flowers/seasons, robbing the 8th', 20, 1, true],
    ['Special hands (replace everything else)', 'All flowers and seasons', 30, 1, true],
    ['Special hands (replace everything else)', 'Three Great Scholars', 30, 1, true],
    ['Special hands (replace everything else)', 'Little Four Winds', 30, 1, true],
    ['Special hands (replace everything else)', 'Big Four Winds', 40, 1, true],
    ['Special hands (replace everything else)', 'Seven pairs and a triplet', 30, 1, true],
    ['Special hands (replace everything else)', 'Heavenly Hand', 40, 1, true],
    ['Special hands (replace everything else)', 'Earthly Hand', 40, 1, true],
  ].map((p) => ({ id: 'tw_' + p[1].toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''), g: p[0], label: p[1], pts: p[2], max: p[3] || 1, solo: !!p[4] }));

  // Winning is worth 2 tai and self-drawn 1 (already implied by Fully concealed hand); the total is paid
  // directly: discarder alone pays it on a discard, all three losers pay it when self-drawn.
  function twScore({ tai, special = 0, selfDraw = false, fullyConcealed = false, concealed = false, base = 0, unit = 1, limit = 0 }) {
    if (fullyConcealed && !selfDraw) return { ok: false, error: 'A fully concealed hand must be won by self-draw.' };
    let t;
    if (special > 0) t = special;
    else {
      t = tai + 2 + (selfDraw && !fullyConcealed ? 1 : 0) - (fullyConcealed && concealed ? 1 : 0);
    }
    const raw = t;
    if (limit > 0) t = Math.min(t, limit);
    const amount = base + t * unit;
    const lines = selfDraw
      ? [{ label: 'Each of 3 players pays', amount, count: 3 }]
      : [{ label: 'Discarder pays', amount, count: 1 }];
    return {
      ok: true, headline: t + ' tai',
      sub: (raw > t ? raw + ' tai, capped at ' + t : special > 0 ? 'Special hand' : '') + (unit !== 1 || base ? ' · ' + base + ' + ' + t + ' × ' + unit : ''),
      lines, total: amount * (selfDraw ? 3 : 1),
    };
  }

  /* ───────────── Chinese Classical (points and doubles) ───────────── */

  const CC_ITEMS = (() => {
    const out = [];
    const add = (g, label, o) => out.push(Object.assign({ id: 'cc_' + label.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''), g, label, pts: 0, dbl: 0, max: 1 }, o));
    const sets = [['simples', 2, 4], ['terminals', 4, 8], ['winds', 4, 8], ['dragons', 4, 8]];
    for (const [k, m, c] of sets) {
      add('Basic sets (points)', 'Pung of ' + k + ', melded', { pts: m, max: 4 });
      add('Basic sets (points)', 'Pung of ' + k + ', concealed', { pts: c, max: 4 });
    }
    for (const [k, m, c] of sets) {
      add('Basic sets (points)', 'Kong of ' + k + ', melded', { pts: m * 4, max: 4 });
      add('Basic sets (points)', 'Kong of ' + k + ', concealed', { pts: c * 4, max: 4 });
    }
    add('Pairs (points)', 'Pair of own wind', { pts: 2 });
    add('Pairs (points)', 'Pair of round wind', { pts: 2 });
    add('Pairs (points)', 'Pair of dragons', { pts: 2 });
    add('Flowers and seasons', 'Each flower or season', { pts: 4, max: 8 });
    add('Flowers and seasons', 'Flower and season of own wind', { dbl: 1 });
    add('Flowers and seasons', 'All flowers', { dbl: 1 });
    add('Flowers and seasons', 'All seasons', { dbl: 1 });
    add('Flowers and seasons', 'All flowers and seasons (instead of the three above)', { dbl: 3 });
    add('Winning bonuses (points)', 'Self-drawn last tile', { pts: 2 });
    add('Winning bonuses (points)', 'Out on a pair', { pts: 2 });
    add('Winning bonuses (points)', 'Out on a major pair (terminal/honor), with Out on a pair', { pts: 2 });
    add('Winning bonuses (points)', 'One-chance hand', { pts: 2 });
    add('Doubles', 'Dragon pung or kong (each)', { dbl: 1, max: 3 });
    add('Doubles', 'Pung or kong of own wind', { dbl: 1 });
    add('Doubles', 'Pung or kong of round wind', { dbl: 1 });
    add('Doubles', 'Three concealed triplets', { dbl: 1 });
    add('Doubles', 'Little Three Dragons (replaces dragon doubles)', { dbl: 3 });
    add('Doubles', 'Big Three Dragons (replaces dragon doubles)', { dbl: 5 });
    add('Doubles', 'Little Four Winds', { dbl: 1 });
    add('Doubles', 'Fully concealed hand', { dbl: 1 });
    add('Doubles', 'Chow hand (no scoring pair)', { dbl: 1 });
    add('Doubles', 'Pung hand', { dbl: 1 });
    add('Doubles', 'All terminals and honors', { dbl: 1 });
    add('Doubles', 'One suit and honors', { dbl: 1 });
    add('Doubles', 'One suit only', { dbl: 3 });
    add('Doubles', 'Out on the last tile of the wall', { dbl: 1 });
    add('Doubles', 'Out on the last discard', { dbl: 1 });
    add('Doubles', 'Out on a supplement tile (kong)', { dbl: 1 });
    add('Doubles', 'Out by robbing a kong', { dbl: 1 });
    add('Doubles', 'Ready on first turn', { dbl: 1 });
    for (const n of ['All Green', 'Four Kongs', 'Hidden Treasure', 'Three Great Scholars', 'Big Four Winds', 'All Honors', 'All Terminals',
      'Nine Gates', 'Thirteen Orphans', 'Fully Concealed Suit Hand', 'Heavenly Hand', 'Earthly Hand', 'Moon from the Bottom of the Sea',
      'Plum Blossom on the Roof', 'Scratching a Carrying Pole', 'Kong on Kong', "Dealer's Consecutive Wins (13)"]) {
      add('Limit hands', n, { limit: true });
    }
    return out;
  })();

  // east: 'winner' | '1' | '2' | '3' (which loser is East). losers: the three losers' own scores.
  function ccScore({ points, doubles, limit = 1000, isLimit = false, round = false, east = 'winner', losers = [0, 0, 0] }) {
    let raw = points * Math.pow(2, doubles);
    if (round) raw = Math.round(raw / 10) * 10;
    const score = isLimit ? limit : Math.min(raw, limit);
    const eastIs = (i) => east === 'winner' || east === String(i + 1);
    const lines = [];
    const net = [0, 0, 0];
    let total = 0;
    losers.forEach((_, i) => {
      const pay = score * (eastIs(i) ? 2 : 1);
      lines.push({ label: 'Loser ' + (i + 1) + ' pays winner' + (eastIs(i) ? ' (East ×2)' : ''), amount: pay, count: 1 });
      net[i] -= pay;
      total += pay;
    });
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const diff = losers[i] - losers[j];
        if (!diff) continue;
        const amt = Math.abs(diff) * (east === String(i + 1) || east === String(j + 1) ? 2 : 1);
        const [hi, lo] = diff > 0 ? [i, j] : [j, i];
        net[hi] += amt; net[lo] -= amt;
        lines.push({ label: 'Loser ' + (lo + 1) + ' pays Loser ' + (hi + 1) + (amt !== Math.abs(diff) ? ' (East ×2)' : ''), amount: amt, count: 1, settle: true });
      }
    }
    const nets = [{ label: 'Winner' + (east === 'winner' ? ' (East)' : ''), amount: total }]
      .concat(net.map((n, i) => ({ label: 'Loser ' + (i + 1) + (east === String(i + 1) ? ' (East)' : ''), amount: n })));
    const sub = isLimit ? 'Limit hand' : raw > score ? points + ' pts × 2^' + doubles + ' = ' + raw + ', capped at ' + limit : points + ' pts × 2^' + doubles;
    return { ok: true, headline: score + ' points', sub, lines, total, nets };
  }

  /* ───────────── Chinese New Style (faan-laak, Four Winds) ───────────── */

  // Settling table (6-9-12 system, limit 64): faan 0..19, then index 20 = "20 or more"
  const CN_TABLE = [1, 2, 4, 8, 16, 32, 64, 74, 84, 128, 138, 148, 256, 266, 276, 512, 522, 532, 542, 552, 1024];
  const CN_LIMIT_POINTS = 1024; // 1600% of the 64-point limit

  // [group, label, faan, max, limit]
  const CN_PATTERNS = [
    ['Basic sets', 'Dragon pung or kong (each)', 1, 3], ['Basic sets', 'Own wind pung or kong', 1], ['Basic sets', 'Round wind pung or kong', 1],
    ['Flowers', 'Flower of own wind', 1], ['Flowers', 'Season of own wind', 1], ['Flowers', 'All flowers', 2],
    ['Flowers', 'All seasons', 2], ['Flowers', 'All flowers and seasons', 12], ['Flowers', 'No flowers or seasons', 1],
    ['Hand', 'Same chow from all suits', 3], ['Hand', 'Two identical chows', 2, 2], ['Hand', 'Two identical chows twice', 9],
    ['Hand', '123 and 789 of the same suit', 1, 2], ['Hand', 'Three chows of 1 suit, step 3', 3],
    ['Hand', 'Triplets 1 and 9 of the same suit', 1, 2], ['Hand', 'Little three dragons', 6],
    ['Hand', 'Exposed hand (single-tile wait)', 2], ['Hand', 'Concealed hand', 1], ['Hand', 'Fully concealed hand', 3],
    ['Hand', 'Chow hand', 1], ['Hand', 'Pung hand', 3], ['Hand', 'All simples', 1],
    ['Hand', 'Terminal or honor in each set', 2], ['Hand', 'Terminal in each set', 3], ['Hand', 'All terminals and honors', 6],
    ['Hand', 'All suits, dragons and winds', 3], ['Hand', 'Two suits only', 1], ['Hand', 'One suit and honors', 3],
    ['Hand', 'One suit only', 9], ['Hand', 'Four same in two sets', 1, 4], ['Hand', 'Four same in three sets', 1, 4],
    ['Hand', 'Four same in four sets', 1],
    ['Going out', 'Self-drawn last tile', 1], ['Going out', 'Out on a one-chance chow', 1], ['Going out', 'Out on a pair', 1],
    ['Going out', 'Out on 4th of its kind', 1], ['Going out', 'Out on the last tile of the wall', 1],
    ['Going out', 'Out on the last discard', 1], ['Going out', 'Out on a supplement tile', 1], ['Going out', 'Out by robbing a kong', 1],
    ['Big hands (faan)', 'Three Great Scholars (includes dragon faan)', 9], ['Big hands (faan)', 'Little Four Winds', 12],
    ['Limit hands (1600% of limit)', 'Four Kongs', 0, 1, true], ['Limit hands (1600% of limit)', 'Hidden Treasure', 0, 1, true],
    ['Limit hands (1600% of limit)', 'Big Four Winds', 0, 1, true], ['Limit hands (1600% of limit)', 'All Honors', 0, 1, true],
  ].map((p) => ({ id: 'cn_' + p[1].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), g: p[0], label: p[1], pts: p[2], max: p[3] || 1, limit: !!p[4] }));

  // Chinese Modern payment: each loser pays F; discarder pays 2F; on self-draw every loser pays 2F.
  function cnScore({ faan, isLimit = false, selfDraw = false, fullyConcealed = false, min = 0 }) {
    if (faan < min) return { ok: false, error: 'Below the ' + min + '-faan minimum (' + faan + ' faan).' };
    // self-drawn is 1 faan, already implied by a fully concealed hand
    const total = faan + (selfDraw && !fullyConcealed ? 1 : 0);
    const F = isLimit ? CN_LIMIT_POINTS : CN_TABLE[Math.min(total, 20)];
    const lines = selfDraw
      ? [{ label: 'Each of 3 players pays', amount: 2 * F, count: 3 }]
      : [{ label: 'Discarder pays', amount: 2 * F, count: 1 }, { label: 'Each other player pays', amount: F, count: 2 }];
    return {
      ok: true, headline: F + ' points',
      sub: isLimit ? 'Limit hand' : total + ' faan' + (selfDraw ? ' (incl. self-drawn)' : ''),
      lines, total: selfDraw ? 6 * F : 4 * F,
    };
  }

  const api = {
    ceil100, RIICHI_YAKU, RIICHI_MELD_FU, riichiHan, riichiFu, riichiBasic, riichiScore,
    MCR_PATTERNS, mcrScore, HK_HALF, HK_FW, HK_PATTERNS, hkTable, hkScore, TW_PATTERNS, twScore, CC_ITEMS, ccScore, CN_TABLE, CN_PATTERNS, cnScore,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mahjong = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
