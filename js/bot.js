// Enkel bot: heuristiker för byte, Chicago-bud och stickspel.

import { evaluate5 } from './poker.js';

// Vilka kort som ska bytas: behåll kort som bidrar till par/triss, färgdrag
// eller stegdrag. Returnerar index i handen att slänga.
export function botExchange(hand) {
  const ranks = {}, suits = {};
  for (const c of hand) {
    ranks[c.r] = (ranks[c.r] || 0) + 1;
    suits[c.s] = (suits[c.s] || 0) + 1;
  }
  const ev = evaluate5(hand);
  const value = hand.map(c => {
    let v = 0;
    v += (ranks[c.r] - 1) * 3;          // par/triss/fyrtal
    v += (suits[c.s] - 1) * 1.2;        // färgpotential
    v += (ranks[c.r - 1] ? 1 : 0) + (ranks[c.r + 1] ? 1 : 0); // stegdrag
    if (c.r === 14) v += 0.5;
    if (c.r >= 13) v += 0.2;
    return v;
  });
  let keep = 0;
  for (const v of value) if (v >= 2) keep++;
  if (ev.cat >= 2) keep = Math.max(keep, ev.cat >= 4 ? 5 : 3);
  const order = value.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); // sämst först
  const nDiscard = Math.max(0, Math.min(5, 5 - keep));
  return order.slice(0, nDiscard).map(x => x[1]);
}

// Budar Chicago bara med riktigt starka händer och tillräckligt många poäng.
export function botWantsChicago(hand, points) {
  if (points < 15) return false;
  const ev = evaluate5(hand);
  if (ev.cat >= 7) return true; // fyrtal eller bättre
  const aces = hand.filter(c => c.r === 14).length;
  const kings = hand.filter(c => c.r === 13).length;
  return aces + kings >= 4;
}

// Vilket kort som ska spelas. hand är kvarvarande kort, trickCards är redan
// spelade kort i sticket {player, card}, mustSuit är utspelsfärg eller null.
// isBidder: boten har budat Chicago. opponentBid: en motståndare har budat.
export function botPlay({ hand, trickCards, mustSuit, isBidder, opponentBid, trickNo }) {
  const legal = mustSuit != null && hand.some(c => c.s === mustSuit)
    ? hand.filter(c => c.s === mustSuit)
    : hand;
  const pick = (arr, cmp) => arr.reduce((a, b) => (cmp(a, b) <= 0 ? a : b));
  const lowest = () => hand.indexOf(pick(legal, (a, b) => a.r - b.r));
  if (mustSuit == null) {
    // Utspel: budgivaren spelar sitt högsta, annars sitt lägsta.
    if (isBidder) return hand.indexOf(pick(legal, (a, b) => b.r - a.r));
    return lowest();
  }
  const winning = Math.max(...trickCards.filter(t => t.card.s === mustSuit).map(t => t.card.r));
  const winners = legal.filter(c => c.r > winning);
  if (isBidder) {
    // Måste ta sticket om möjligt, annars dumpa lägst.
    if (winners.length) return hand.indexOf(pick(winners, (a, b) => a.r - b.r));
    return lowest();
  }
  // Försvarare: vinn sticket om det bryter motståndarens Chicago-bud eller är
  // sista sticket (5 p), annars spela det lägsta.
  if (winners.length && (opponentBid || trickNo === 4)) {
    return hand.indexOf(pick(winners, (a, b) => a.r - b.r));
  }
  return lowest();
}

// Ska boten ta det öppna kortet? Ta det om det minst behåller handens kategori.
export function botOpenChoice(hand, openCard, idx) {
  const remaining = hand.filter((_, k) => k !== idx);
  const withOpen = evaluate5([...remaining, openCard]);
  return withOpen.cat >= evaluate5(hand).cat;
}
