// Kortlek och pokerhandsutvärdering för Chicago (svenska regler).

export const SUITS = ['♠', '♥', '♦', '♣']; // spader, hjärter, ruter, klöver
const RANK_LABELS = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const SUIT_NAMES = ['spader', 'hjärter', 'ruter', 'klöver'];

export function newDeck() {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  return d;
}

export function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rankLabel(r) { return RANK_LABELS[r]; }
export function cardLabel(c) { return `${SUIT_NAMES[c.s]} ${RANK_LABELS[c.r]}`; }

// Utvärderar exakt 5 kort. Kategorier: 0 hög hand, 1 par, 2 två par, 3 triss,
// 4 stege, 5 färg, 6 kåk, 7 fyrtal, 8 färgstege (royal = färgstege med ess högsta).
export function evaluate5(cards) {
  const rs = cards.map(c => c.r).sort((a, b) => b - a);
  const flush = cards.every(c => c.s === cards[0].s);
  let straightHigh = 0;
  const uniq = [...new Set(rs)];
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[1] - uniq[4] === 3) straightHigh = 5; // A-2-3-4-5
  }
  const counts = {};
  for (const r of rs) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.keys(counts).map(r => ({ r: +r, c: counts[r] })).sort((a, b) => b.c - a.c || b.r - a.r);
  let cat, tie;
  if (flush && straightHigh) { cat = 8; tie = [straightHigh]; }
  else if (groups[0].c === 4) { cat = 7; tie = [groups[0].r, groups[1].r]; }
  else if (groups[0].c === 3 && groups[1].c === 2) { cat = 6; tie = [groups[0].r, groups[1].r]; }
  else if (flush) { cat = 5; tie = rs; }
  else if (straightHigh) { cat = 4; tie = [straightHigh]; }
  else if (groups[0].c === 3) { cat = 3; tie = [groups[0].r, groups[1].r, groups[2].r]; }
  else if (groups[0].c === 2 && groups[1].c === 2) { cat = 2; tie = [groups[0].r, groups[1].r, groups[2].r]; }
  else if (groups[0].c === 2) { cat = 1; tie = [groups[0].r, groups[1].r, groups[2].r, groups[3].r]; }
  else { cat = 0; tie = rs; }
  return { cat, tie, cards };
}

export const CAT_NAMES = ['Hög hand', 'Par', 'Två par', 'Triss', 'Stege', 'Färg', 'Kåk', 'Fyrtal', 'Färgstege'];
const CAT_POINTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function handPoints(ev) {
  if (ev.cat === 8 && ev.tie[0] === 14) return 52; // royal straight flush
  return CAT_POINTS[ev.cat];
}

export function handName(ev) {
  return (ev.cat === 8 && ev.tie[0] === 14) ? 'Royal straight flush' : CAT_NAMES[ev.cat];
}

// Positivt = a slår b, 0 = exakt lika, negativt = b slår a.
export function compareHands(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  const n = Math.max(a.tie.length, b.tie.length);
  for (let i = 0; i < n; i++) {
    const x = a.tie[i] || 0, y = b.tie[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}
