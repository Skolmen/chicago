// Rigorös testsvit för Chicago (issue 84). Kör: node test-all.js
import { Game, RULES } from './js/engine.js?v=25';
import { newDeck, evaluate5, compareHands, handPoints } from './js/poker.js?v=25';
import { botExchange, botWantsChicago, botPlay, botOpenChoice, botBud, botHalvAsk, botHalvAnswer } from './js/bot.js?v=25';

let failures = 0, checks = 0;
function check(name, cond, extra) {
  checks++;
  if (!cond) { failures++; console.log('FEL: ' + name + (extra !== undefined ? ' [' + extra + ']' : '')); }
}
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const C = (r, s) => ({ r, s });
const SP = 0, HJ = 1, RU = 2, KL = 3;
const has = (hand, r, s) => hand.some(c => c.r === r && c.s === s);

// ============ A. Handutvärdering: alla 2 598 960 femkorthänder ============
{
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  // Exakta pokersannolikheter; ess-inte-lägst flyttar 1 020 hjulstegar till
  // hög hand och 4 hjulfärger till färg (färgstege 36 i stället för 40).
  const expect = { 0: 1303560, 1: 1098240, 2: 123552, 3: 54912, 4: 9180, 5: 5112, 6: 3744, 7: 624, 8: 36 };
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  const sample = [];
  const hand = [null, null, null, null, null];
  for (let a = 0; a < 48; a++) for (let b = a + 1; b < 49; b++) for (let c = b + 1; c < 50; c++) for (let d = c + 1; d < 51; d++) for (let e = d + 1; e < 52; e++) {
    hand[0] = deck[a]; hand[1] = deck[b]; hand[2] = deck[c]; hand[3] = deck[d]; hand[4] = deck[e];
    const ev = evaluate5(hand);
    counts[ev.cat]++;
    if ((a * 53 + b * 31 + c * 17 + d * 7 + e) % 1737 === 0) sample.push({ cat: ev.cat, tie: ev.tie });
  }
  let total = 0;
  const CATN = ['Hög hand', 'Par', 'Två par', 'Triss', 'Stege', 'Färg', 'Kåk', 'Fyrtal', 'Färgstege'];
  for (let k = 0; k <= 8; k++) { total += counts[k]; check(`antal ${CATN[k]} = ${expect[k]}`, counts[k] === expect[k], counts[k]); }
  check('summan är alla händer', total === 2598960, total);
  let pairBad = 0, pairChecks = 0;
  for (let i = 0; i < sample.length; i++) for (let j = i + 1; j < sample.length; j++) {
    const a = sample[i], b = sample[j];
    const lex = a.cat !== b.cat ? Math.sign(a.cat - b.cat)
      : (() => { const n = Math.max(a.tie.length, b.tie.length); for (let k = 0; k < n; k++) { const x = a.tie[k] || 0, y = b.tie[k] || 0; if (x !== y) return Math.sign(x - y); } return 0; })();
    if (Math.sign(compareHands(a, b)) !== lex) pairBad++;
    pairChecks++;
  }
  check(`compareHands == lexikografisk ordning (${pairChecks} par)`, pairBad === 0, pairBad);
}
// A2. Kanoniska specialfall
{
  check('A-2-3-4-5 är INTE stege (ess är inte lägst)', evaluate5([C(14, SP), C(2, HJ), C(3, RU), C(4, KL), C(5, SP)]).cat === 0);
  check('2-3-4-5-6 är stege med 6 hög', (() => { const e = evaluate5([C(2, SP), C(3, HJ), C(4, RU), C(5, KL), C(6, SP)]); return e.cat === 4 && e.tie[0] === 6; })());
  check('A-10-J-Q-K är stege med ess hög', (() => { const e = evaluate5([C(14, SP), C(10, HJ), C(11, RU), C(12, KL), C(13, SP)]); return e.cat === 4 && e.tie[0] === 14; })());
  check('kunglig färgstege', (() => { const e = evaluate5([C(14, SP), C(10, SP), C(11, SP), C(12, SP), C(13, SP)]); return e.cat === 8 && e.tie[0] === 14 && handPoints(e) === 52; })());
  check('färgstege 5-6-7-8-9 i klöver', (() => { const e = evaluate5([C(5, KL), C(6, KL), C(7, KL), C(8, KL), C(9, KL)]); return e.cat === 8 && e.tie[0] === 9; })());
  check('fyrtal med kneckt som kneckt', (() => { const e = evaluate5([C(9, SP), C(9, HJ), C(9, RU), C(9, KL), C(4, SP)]); return e.cat === 7 && e.tie[0] === 9 && e.tie[1] === 4; })());
  check('två par: [hög, låg, kneckt]', (() => { const e = evaluate5([C(13, SP), C(13, HJ), C(5, RU), C(5, KL), C(12, SP)]); return e.cat === 2 && e.tie[0] === 13 && e.tie[1] === 5 && e.tie[2] === 12; })());
  check('kåk: [triss, par]', (() => { const e = evaluate5([C(3, SP), C(3, HJ), C(3, RU), C(12, KL), C(12, SP)]); return e.cat === 6 && e.tie[0] === 3 && e.tie[1] === 12; })());
  check('färg jämförs kort för kort', (() => { const e = evaluate5([C(14, HJ), C(11, HJ), C(9, HJ), C(5, HJ), C(3, HJ)]); return e.cat === 5 && e.tie[0] === 14 && e.tie[4] === 3; })());
  check('par med fyra knecktar i ordning', (() => { const e = evaluate5([C(11, SP), C(11, HJ), C(14, RU), C(8, KL), C(5, SP)]); return e.cat === 1 && e.tie[0] === 11 && e.tie[1] === 14 && e.tie[3] === 5; })());
  const hs = [
    [C(7, SP), C(7, HJ), C(3, RU), C(9, KL), C(11, SP)],
    [C(13, SP), C(13, HJ), C(5, RU), C(5, KL), C(2, SP)],
    [C(3, SP), C(3, HJ), C(3, RU), C(9, KL), C(11, SP)],
    [C(2, SP), C(3, HJ), C(4, RU), C(5, KL), C(6, SP)],
    [C(14, HJ), C(9, HJ), C(5, HJ), C(3, HJ), C(2, HJ)],
    [C(3, SP), C(3, HJ), C(3, RU), C(12, KL), C(12, SP)],
    [C(9, SP), C(9, HJ), C(9, RU), C(9, KL), C(4, SP)],
    [C(5, KL), C(6, KL), C(7, KL), C(8, KL), C(9, KL)]
  ];
  check('poäng: par 1, två par 2, triss 3, stege 4, färg 5, kåk 6, fyrtal 8, färgstege 52',
    [1, 2, 3, 4, 5, 6, 8, 52].every((p, i) => handPoints(evaluate5(hs[i])) === p));
}

// ============ B. Poängen per kategori genom hela budflödet ============
function budGame() {
  const g = new Game(['Du', 'Datorn'], mulberry32(7));
  g.dealer = 1; g.exchanged = new Set(); g.discard = [];
  g.beginBud('test', 'givEnd');
  return g;
}
function budScore(hand0) {
  const g = budGame();
  g.players[0].hand = hand0;
  g.players[1].hand = [C(2, SP), C(3, HJ), C(5, RU), C(7, KL), C(9, SP)];
  g.announceBud(0); g.announceBud(1); // p1 hög hand: tyst
  return { g, pts: g.players[0].points };
}
{
  const cases = [
    ['par', [C(7, SP), C(7, HJ), C(3, RU), C(9, KL), C(11, SP)], 1],
    ['två par', [C(13, SP), C(13, HJ), C(5, RU), C(5, KL), C(2, SP)], 2],
    ['triss', [C(3, SP), C(3, HJ), C(3, RU), C(9, KL), C(11, SP)], 3],
    ['stege', [C(2, SP), C(3, HJ), C(4, RU), C(5, KL), C(6, SP)], 4],
    ['färg', [C(14, HJ), C(9, HJ), C(5, HJ), C(3, HJ), C(2, HJ)], 5],
    ['kåk', [C(3, SP), C(3, HJ), C(3, RU), C(12, KL), C(12, SP)], 6],
    ['färgstege', [C(5, KL), C(6, KL), C(7, KL), C(8, KL), C(9, KL)], 52]
  ];
  for (const [namn, hand, forv] of cases) { const r = budScore(hand); check(`${namn} ger ${forv} p via budgivningen`, r.pts === forv, r.pts); }
  const r = budScore([C(9, SP), C(9, HJ), C(9, RU), C(9, KL), C(4, SP)]);
  check('fyrtal öppnar valet', r.g.phase === 'fyrtalVal' && r.g.awaiting && r.g.awaiting.player === 0, r.g.phase);
  r.g.fyrtalTake(0);
  check('fyrtal ger 8 p', r.g.players[0].points === 8);
  const g = new Game(['Du', 'Datorn'], mulberry32(8));
  g.players[0].points = 30; g.players[1].points = 44;
  g.dealer = 1; g.exchanged = new Set(); g.discard = [];
  g.beginBud('test', 'givEnd');
  g.players[0].hand = [C(9, SP), C(9, HJ), C(9, RU), C(9, KL), C(4, SP)];
  g.players[1].hand = [C(2, SP), C(3, HJ), C(5, RU), C(7, KL), C(9, SP)];
  g.announceBud(0); g.announceBud(1);
  check('fyrtalvalet väntar', g.phase === 'fyrtalVal');
  g.fyrtalZero(0);
  check('nollställning: alla 0 och spärrad', g.players[0].points === 0 && g.players[1].points === 0 && g.fyrtalZeroUsed);
  g.nextGiv();
  g.dealer = 1; g.exchanged = new Set(); g.discard = [];
  g.beginBud('test2', 'givEnd');
  g.players[0].hand = [C(10, SP), C(10, HJ), C(10, RU), C(10, KL), C(4, SP)];
  g.players[1].hand = [C(2, SP), C(3, HJ), C(5, RU), C(7, KL), C(9, SP)];
  g.announceBud(0); g.announceBud(1);
  check('andra fyrtal betalar 8 p direkt utan val', g.players[0].points === 8 && g.phase === 'givEnd' && g.fyrtalZeroUsed, `${g.players[0].points}/${g.phase}`);
}

// ============ C. Budgivningens regler ============
{
  const g = budGame();
  g.players[0].hand = [C(13, SP), C(13, HJ), C(3, RU), C(9, KL), C(11, SP)];
  g.players[1].hand = [C(12, SP), C(12, HJ), C(4, RU), C(9, KL), C(11, SP)];
  g.announceBud(0); g.announceBud(1);
  check('lägre par får utmana: halvering öppnas', g.budAnnounced === 0 && g.halv && g.halv.asker === 1 && g.halv.target === 0);
  g.halvAsk(1);
  check('lägre utmanare frågar vid eget värde', g.awaiting.n === 12);
  g.halvAnswer(0, 'över');
  check('över: budhållaren behåller direkt', g.budAnnounced === 0 && g.halv === null && g.log.some(l => l.includes('har över och behåller')));
  const g2 = budGame();
  g2.players[0].hand = [C(2, SP), C(3, HJ), C(5, RU), C(7, KL), C(9, SP)];
  g2.announceBud(0);
  g2.players[1].hand = [C(9, SP), C(9, HJ), C(9, RU), C(9, KL), C(4, SP)];
  check('budordning börjar hos spelaren efter givaren', g2.budOrder[0] === 0 && g2.awaiting.player === 1);
  g2.budPass(1);
  check('tjuvpassning blockeras', g2.awaiting && g2.awaiting.player === 1 && g2.log.some(l => l.includes('får inte tjuvpassa')));
  g2.announceBud(1);
  check('tvingad annons går igenom', g2.budAnnounced === 1 && g2.budCat === 7);
  const lika = [C(13, SP), C(13, HJ), C(3, RU), C(9, KL), C(11, SP)];
  const g3 = budGame();
  g3.players[0].hand = lika.slice(); g3.players[1].hand = lika.slice();
  g3.announceBud(0); g3.announceBud(1);
  check('exakt lika hand öppnar halvering', !!g3.halv && g3.halv.asker === 1);
  let guardLika = 0;
  while (g3.awaiting && g3.awaiting.action === 'halvAsk' && guardLika++ < 10) {
    g3.halvAsk(1);
    g3.halvAnswer(0, 'exakt');
  }
  check('identiska händer: budhållaren behåller', g3.budAnnounced === 0 && g3.halv === null && g3.log.some(l => l.includes('identiska')));
  const g4 = budGame();
  g4.players[0].hand = [C(13, SP), C(13, HJ), C(3, RU), C(9, KL), C(11, SP)];
  g4.players[1].hand = [C(2, SP), C(3, HJ), C(4, RU), C(5, KL), C(6, SP)];
  g4.announceBud(0); g4.announceBud(1);
  check('stege slår par oavsett kort', g4.budAnnounced === 1 && g4.budCat === 4);
  const g5 = budGame();
  g5.players[0].hand = [C(2, SP), C(3, HJ), C(5, RU), C(7, KL), C(9, SP)];
  g5.players[1].hand = [C(2, HJ), C(3, SP), C(5, KL), C(7, RU), C(9, HJ)];
  g5.announceBud(0); g5.announceBud(1);
  check('ingen hand, inga poäng', g5.budAnnounced === null && g5.players.every(p => p.points === 0));
}

// ============ D. Halvering inklusive knektregeln ============
{
  const g = budGame();
  g.players[0].hand = [C(11, SP), C(11, HJ), C(3, RU), C(7, KL), C(5, SP)];
  g.players[1].hand = [C(11, SP), C(11, HJ), C(3, RU), C(8, KL), C(5, SP)];
  g.announceBud(0); g.announceBud(1);
  check('halvering öppnas vid samma par', !!g.halv && g.halv.comp === 0 && g.awaiting.player === 1);
  g.halvAsk(1);
  check('frågan gäller paret vid delarens eget värde', g.awaiting.action === 'halvAnswer' && g.awaiting.label === 'ditt par' && g.awaiting.n === 11);
  g.halvAnswer(0, 'exakt');
  check('samma valör: vidare till högsta kortet efteråt', g.halv.comp === 1 && g.log.some(l => l.includes('högsta kortet efteråt')));
  g.halvAsk(1, 8);
  check('botens knektsvar är sant (7 under 8)', botHalvAnswer(g.players[0].hand, 8, 1) === 'under');
  g.halvAnswer(0, 'under');
  check('delaren med högst kort tar budet direkt', g.budAnnounced === 1 && g.budNote === 'övertog budet' && g.halv === null);
  const g2 = budGame();
  g2.players[0].hand = [C(11, SP), C(11, HJ), C(3, RU), C(7, KL), C(5, SP)];
  g2.players[1].hand = [C(12, SP), C(12, HJ), C(3, RU), C(7, KL), C(5, SP)];
  g2.announceBud(0); g2.announceBud(1);
  g2.halvAsk(1);
  check('frågan vid eget värde', g2.awaiting.n === 12);
  g2.halvAnswer(0, 'över');
  check('över: budhållaren behåller trots samma lägre kort', g2.budAnnounced === 0 && g2.halv === null);
  const g3 = budGame();
  g3.players[0].hand = [C(11, SP), C(11, HJ), C(3, RU), C(7, KL), C(5, SP)];
  g3.players[1].hand = [C(11, SP), C(11, HJ), C(3, RU), C(8, KL), C(5, SP)];
  g3.announceBud(0); g3.announceBud(1);
  const before = JSON.stringify(g3.awaiting);
  g3.halvAsk(0, 11);
  check('halvAsk av fel spelare ignoreras', JSON.stringify(g3.awaiting) === before);
  g3.halvAsk(1, 11);
  const before2 = JSON.stringify(g3.awaiting);
  g3.halvAnswer(1, 'exakt');
  check('halvAnswer av fel spelare ignoreras', JSON.stringify(g3.awaiting) === before2);
  check('botHalvAsk följer comp', botHalvAsk(g3.players[1].hand, 0) === 11 && botHalvAsk(g3.players[1].hand, 1) === 8);
  // Treor mot kungar i båda riktningarna: ett enda svar avgör
  const g4 = budGame();
  g4.players[0].hand = [C(13, SP), C(13, HJ), C(3, RU), C(9, KL), C(11, SP)];
  g4.players[1].hand = [C(3, SP), C(3, HJ), C(5, RU), C(9, KL), C(11, SP)];
  g4.announceBud(0); g4.announceBud(1);
  g4.halvAsk(1);
  check('lägre utmanare frågar vid sitt eget värde', g4.awaiting.n === 3);
  g4.halvAnswer(0, 'över');
  check('kungar mot treor: budhållaren behåller efter en fråga', g4.budAnnounced === 0 && g4.halv === null && g4.log.filter(l => l.includes('över eller under')).length === 1);
  const g5 = budGame();
  g5.players[0].hand = [C(3, SP), C(3, HJ), C(5, RU), C(9, KL), C(11, SP)];
  g5.players[1].hand = [C(13, SP), C(13, HJ), C(3, RU), C(9, KL), C(11, SP)];
  g5.announceBud(0); g5.announceBud(1);
  g5.halvAsk(1);
  g5.halvAnswer(0, 'under');
  check('treor mot kungar: delaren tar budet efter en fråga', g5.budAnnounced === 1 && g5.halv === null && g5.log.filter(l => l.includes('över eller under')).length === 1);
}

// ============ E. Byte, öppet kort, talong ============
function kopGame() {
  const g = new Game(['Du', 'Datorn'], mulberry32(9));
  g.start();
  return g;
}
function setTalong(g, top) { g.talong = g.talong.slice(0, g.talong.length - top.length).concat(top); }
function cardCount(g) {
  let n = 0;
  for (const p of g.players) n += p.hand.length;
  n += g.talong.length + g.discard.length + (g.trickCards ? g.trickCards.length : 0);
  return n;
}
function allCards(g) {
  const out = [];
  for (const p of g.players) for (const c of p.hand) out.push(c.r + ':' + c.s);
  for (const c of g.talong) out.push(c.r + ':' + c.s);
  for (const c of g.discard) out.push(c.r + ':' + c.s);
  for (const t of (g.trickCards || [])) out.push(t.card.r + ':' + t.card.s);
  return out;
}
{
  const g = kopGame();
  setTalong(g, [C(3, RU), C(14, KL)]);
  const hand0 = g.players[0].hand.slice();
  g.exchange(0, [2], true);
  check('stängt byte drar översta kortet', has(g.players[0].hand, 14, KL) && !has(g.players[0].hand, hand0[2].r, hand0[2].s));
  check('stängt byte: inget openOffer', !g.openOffer && !(g.awaiting && g.awaiting.action === 'openOffer'));
  check('stängt byte: loggen avslöjar inte kortet', !g.log.some(l => l.includes('klöver ess')));
  check('kortbevaring efter stängt byte', cardCount(g) === 52, cardCount(g));
  const g2 = kopGame();
  setTalong(g2, [C(3, RU), C(12, KL)]);
  g2.exchange(1, [0], false);
  check('öppet kort erbjuds', g2.awaiting && g2.awaiting.action === 'openOffer' && g2.openOffer.player === 1);
  g2.resolveOpen(1, true);
  check('taget öppet kort hamnar i handen', has(g2.players[1].hand, 12, KL));
  const g3 = kopGame();
  setTalong(g3, [C(5, SP), C(12, KL)]);
  g3.exchange(1, [0], false);
  g3.resolveOpen(1, false);
  check('slängt öppet kort ligger i skräphögen', g3.discard.some(c => c.r === 12 && c.s === KL));
  check('stängt kort dras efter släng', has(g3.players[1].hand, 5, SP));
  check('kortbevaring efter öppet-kort-val', cardCount(g3) === 52, cardCount(g3));
  const g4 = kopGame();
  g4.discard = g4.talong.splice(0);
  check('talongen är tömd före testet', g4.talong.length === 0 && g4.discard.length === 42);
  g4.exchange(0, [1], true);
  check('talongen blandas om ur skräphögen', g4.log.some(l => l.includes('blandas till ny talong')));
  check('påfylld talong: alla kort kvar', cardCount(g4) === 52 && new Set(allCards(g4)).size === 52);
  const g5 = kopGame();
  const h5 = g5.players[0].hand.slice();
  g5.exchange(0, []);
  check('byta inga: handen orörd', JSON.stringify(g5.players[0].hand) === JSON.stringify(h5) && g5.exchanged.has(0));
  const g6 = kopGame();
  g6.players[0].lastScoredCat = 2;
  g6.exchange(0, [1, 3]);
  check('byteskort visas efter poäng', g6.log.some(l => l.includes('visar byteskorten')));
}

// ============ F. Stickspel ============
function trickGame(seed, hands, autoChicago = true, points1 = 0) {
  const g = new Game(['Du', 'Datorn'], mulberry32(seed));
  g.start(); g.dealer = 1;
  if (hands) { g.players[0].hand = hands[0].slice(); g.players[1].hand = hands[1].slice(); }
  g.players[1].points = points1;
  let guard = 0;
  while (g.phase !== 'tricks' && guard++ < 300) {
    const a = g.awaiting;
    if (!a) break;
    if (a.action === 'exchange') g.exchange(a.player, []);
    else if (a.action === 'bud') { const ev = evaluate5(g.players[a.player].hand); g.canBid(ev) ? g.announceBud(a.player) : g.budPass(a.player); }
    else if (a.action === 'chicago') { if (!autoChicago) break; g.passChicago(); }
    else if (a.action === 'halvAsk') { g.halvAsk(a.player, botHalvAsk(g.players[a.player].hand, g.halv.comp)); }
    else if (a.action === 'halvAnswer') g.halvAnswer(a.player, botHalvAnswer(g.players[a.player].hand, a.n, g.halv ? g.halv.comp : 0));
    else break;
  }
  g.sluthand = [g.players[0].hand.slice(), g.players[1].hand.slice()];
  return g;
}
{
  const g = trickGame(11, [
    [C(14, SP), C(5, RU), C(6, RU), C(7, RU), C(8, RU)],
    [C(2, SP), C(3, KL), C(4, SP), C(13, KL), C(12, SP)]
  ]);
  check('tricks startar hos spelaren efter givaren', g.phase === 'tricks' && g.awaiting.player === 0 && g.awaiting.mustSuit === null);
  g.playCard(0, 1);
  check('utspel: vilket kort som helst gäller', g.trickCards.length === 1);
  g.playCard(1, 0);
  check('högsta kortet i ledfärgen vinner', g.tricksWon[0] === 1, JSON.stringify(g.tricksWon));
  check('vinnaren leder nästa stick', g.awaiting.player === 0);
  g.playCard(0, 1);
  g.playCard(1, 0);
  check('utan färgen får man spela fritt', g.tricksWon[0] === 2);
  check('spelade stickkort hamnar i skräphögen', g.discard.length === 4, g.discard.length);
  const g2 = trickGame(12, [
    [C(14, SP), C(5, RU), C(6, RU), C(7, RU), C(8, RU)],
    [C(2, SP), C(3, SP), C(4, SP), C(13, SP), C(6, RU)]
  ]);
  g2.playCard(0, 1);
  const wrong = g2.players[1].hand.findIndex(c => c.s === SP);
  g2.playCard(1, wrong);
  check('färgbrott blockeras', g2.players[1].hand.length === 5 && g2.log.some(l => l.includes('måste följa färgen')));
  const right = g2.players[1].hand.findIndex(c => c.s === RU);
  g2.playCard(1, right);
  check('lagligt kort efter avvis avgör sticket', g2.tricksWon[1] === 1, JSON.stringify(g2.tricksWon));
  const g3 = trickGame(13, [
    [C(14, SP), C(5, RU), C(6, RU), C(7, RU), C(8, RU)],
    [C(2, SP), C(3, KL), C(4, SP), C(13, KL), C(12, SP)]
  ]);
  const len3 = g3.trickCards.length;
  g3.playCard(1, 0);
  check('spela ur tur ignoreras', g3.trickCards.length === len3);
  g3.playCard(0, 99);
  check('ogiltigt index ignoreras', g3.trickCards.length === len3);
  const g4 = trickGame(14, [
    [C(2, SP), C(3, KL), C(4, SP), C(13, KL), C(12, SP)],
    [C(14, SP), C(5, RU), C(6, RU), C(7, RU), C(8, RU)]
  ]);
  g4.bid = 0;
  g4.playCard(0, 0);
  g4.playCard(1, 0); // p1 måste följa spader och tar med ess -> brutet Chicago
  check('brutet Chicago: −15 och given avslutas', g4.players[0].points === -15 && g4.phase === 'givEnd' && g4.log.some(l => l.includes('bröts')), `${g4.players[0].points}/${g4.phase}`);
}

// ============ G. Chicago-flödet ============
{
  const g = new Game(['Du', 'D1', 'D2'], mulberry32(15));
  g.start(); g.dealer = 2;
  g.players[0].points = 16; g.players[1].points = 16; g.players[2].points = 0;
  let guard = 0;
  while (g.phase !== 'chicago' && guard++ < 500) {
    const a = g.awaiting;
    if (!a) break;
    if (a.action === 'exchange') g.exchange(a.player, []);
    else if (a.action === 'bud') { const ev = evaluate5(g.players[a.player].hand); g.canBid(ev) ? g.announceBud(a.player) : g.budPass(a.player); }
    else if (a.action === 'halvAsk') { g.halvAsk(a.player, botHalvAsk(g.players[a.player].hand, g.halv.comp)); }
    else if (a.action === 'halvAnswer') g.halvAnswer(a.player, botHalvAnswer(g.players[a.player].hand, a.n, g.halv ? g.halv.comp : 0));
    else break;
  }
  check('chicago erbjuds först till spelaren efter givaren', g.awaiting && g.awaiting.action === 'chicago' && g.awaiting.player === 0, JSON.stringify(g.awaiting));
  g.passChicago();
  check('nästa i turordning erbjuds', g.awaiting && g.awaiting.action === 'chicago' && g.awaiting.player === 1);
  g.passChicago();
  check('under 15 p erbjuds inte', g.phase === 'tricks', g.phase);
  const g2 = trickGame(16, [
    [C(2, SP), C(4, SP), C(6, SP), C(8, SP), C(9, SP)],
    [C(14, SP), C(13, SP), C(12, SP), C(11, SP), C(10, SP)]
  ], false, 20);
  check('chicago frågar budhållaren', g2.awaiting && g2.awaiting.action === 'chicago' && g2.awaiting.player === 1, JSON.stringify(g2.awaiting));
  const beforeChi = g2.players[1].points;
  g2.bidChicago(1);
  for (let t = 0; t < 10; t++) {
    const a = g2.awaiting;
    if (!a || a.action !== 'play') break;
    g2.playCard(a.player, 0);
  }
  check('Chicago lyckat: exakt +15 utöver budpoängen', g2.players[1].points === beforeChi + 15, `${g2.players[1].points} vs ${beforeChi + 15}`);
  check('ingen sista sticket-poäng vid lyckat Chicago', !g2.log.some(l => l.includes('sista sticket: +')));
  check('ingen sluthandspoäng vid lyckat Chicago', !g2.log.some(l => l.includes('Sluthand')));
  const g3 = trickGame(17, [
    [C(14, RU), C(13, KL), C(12, RU), C(11, KL), C(9, RU)],
    [C(2, SP), C(3, SP), C(4, SP), C(5, SP), C(9, SP)]
  ], false, 20);
  const beforeChi3 = g3.players[1].points;
  g3.bidChicago(1);
  g3.playCard(0, 0); g3.playCard(1, 0); // p0 tar första sticket med ruter ess
  check('brutet Chicago: −15 från budpoängen', g3.players[1].points === beforeChi3 - 15, `${g3.players[1].points} vs ${beforeChi3 - 15}`);
  check('brutet Chicago avslutar given', g3.phase === 'givEnd' && g3.log.some(l => l.includes('bröts')));
}

// ============ H. Serialisering ============
{
  const g = budGame();
  g.players[0].hand = [C(11, SP), C(11, HJ), C(3, RU), C(7, KL), C(5, SP)];
  g.players[1].hand = [C(11, SP), C(11, HJ), C(3, RU), C(8, KL), C(5, SP)];
  g.announceBud(0); g.announceBud(1);
  g.halvAsk(1, 11); g.halvAnswer(0, 'exakt');
  const snap = JSON.stringify(g.toJSON());
  const g2 = Game.fromJSON(g.toJSON());
  check('runtresa bevarar tillståndet exakt', JSON.stringify(g2.toJSON()) === snap);
  check('halv-state lever vidare', g2.halv && g2.halv.comp === 1 && g2.awaiting.action === 'halvAsk');
  g2.halvAsk(1, 8); g2.halvAnswer(0, 'under');
  check('partiet spelar klart efter laddning', g2.budAnnounced === 1 && g2.halv === null);
  check('fromJSON avvisar skräp', Game.fromJSON(null) === null && Game.fromJSON({ v: 2 }) === null);
  const g3 = trickGame(18, [[C(14, SP), C(5, RU), C(6, RU), C(7, RU), C(8, RU)], [C(2, SP), C(3, SP), C(4, SP), C(13, SP), C(12, SP)]]);
  g3.playCard(0, 1);
  const snap3 = JSON.stringify(g3.toJSON());
  const g4 = Game.fromJSON(g3.toJSON());
  check('sticket lever vidare efter laddning', JSON.stringify(g4.toJSON()) === snap3 && g4.awaiting && g4.awaiting.action === 'play');
  g4.playCard(1, 0);
  check('sticket avgörs efter laddning', g4.tricksWon[0] === 1);
}

// ============ I. Bot-egenskaper ============
{
  const rng = mulberry32(99);
  const rndHand = (n = 5) => { const d = newDeck(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d.slice(0, n); };
  let bad = 0;
  for (let k = 0; k < 4000; k++) {
    const idxs = botExchange(rndHand());
    if (!(idxs.every(i => Number.isInteger(i) && i >= 0 && i < 5) && new Set(idxs).size === idxs.length)) bad++;
  }
  check('botExchange: giltiga unika index (4000 händer)', bad === 0, bad);
  bad = 0;
  for (let k = 0; k < 2000; k++) if (botWantsChicago(rndHand(), 14)) bad++;
  check('botWantsChicago: aldrig under 15 p', bad === 0, bad);
  bad = 0;
  const gb = new Game(['A', 'B'], mulberry32(1));
  for (let k = 0; k < 5000; k++) {
    const hand = rndHand(); const ev = evaluate5(hand);
    const bestCat = Math.floor(rng() * 9);
    const bestEv = bestCat > 0 ? evaluate5(rndHand()) : null;
    gb.budCat = bestCat; gb.budEv = bestEv; gb.budAnnounced = bestCat > 0 ? 1 : null;
    const bb = botBud(hand, bestCat, bestEv);
    const cb = gb.canBid(ev);
    const ms = gb.mustSay(ev);
    // Boten får aldrig annonsera en otillåten hand och aldrig passa en tvingad
    // annons; samma kategori är frivillig utmaning, därför är pass lagligt där.
    if ((bb !== null && (bb !== ev.cat || !cb)) || (ms && bb === null)) bad++;
  }
  check('botBud speglar canBid (5000 drag)', bad === 0, bad);
  bad = 0;
  for (let k = 0; k < 4000; k++) {
    const hand = rndHand(3 + Math.floor(rng() * 3));
    const mustSuit = rng() < 0.5 ? null : Math.floor(rng() * 4);
    const idx = botPlay({ hand, trickCards: [], mustSuit, isBidder: false, opponentBid: false, trickNo: 0 });
    if (!(idx >= 0 && idx < hand.length)) bad++;
    else if (mustSuit != null && hand.some(c => c.s === mustSuit) && hand[idx].s !== mustSuit) bad++;
  }
  check('botPlay: lagligt kort (4000 drag)', bad === 0, bad);
  bad = 0;
  for (let k = 0; k < 2000; k++) {
    const hand = rndHand(); const ev = evaluate5(hand);
    if (ev.cat === 0) continue;
    const comp = Math.floor(rng() * ev.tie.length);
    if (botHalvAsk(hand, comp) !== ev.tie[comp]) bad++;
  }
  check('botHalvAsk: rätt komponent (2000 händer)', bad === 0, bad);
  bad = 0;
  for (let k = 0; k < 2000; k++) {
    const hand = rndHand(); const idx = Math.floor(rng() * 5); const open = rndHand(1)[0];
    const withOpen = evaluate5(hand.filter((_, j) => j !== idx).concat([open]));
    if (botOpenChoice(hand, open, idx) !== (withOpen.cat >= evaluate5(hand).cat)) bad++;
  }
  check('botOpenChoice: kategoriregeln (2000 händer)', bad === 0, bad);
}

// ============ J. Simulerade partier med invariant-kontroller ============
function runGiv(g) {
  let guard = 0;
  while (!g.over && g.phase !== 'givEnd' && guard++ < 5000) {
    const a = g.awaiting;
    if (!a) break;
    const h = g.players[a.player].hand;
    switch (a.action) {
      case 'exchange': {
        const idxs = botExchange(h);
        g.exchange(a.player, idxs, idxs.length === 1 && (g.giv % 3 === 0));
        break;
      }
      case 'openOffer': g.resolveOpen(a.player, botOpenChoice(h, a.card, g.openOffer.idx)); break;
      case 'bud': { const ev = evaluate5(h); g.canBid(ev) ? g.announceBud(a.player) : g.budPass(a.player); break; }
      case 'halvAsk': g.halvAsk(a.player, botHalvAsk(h, g.halv.comp)); break;
      case 'halvAnswer': g.halvAnswer(a.player, botHalvAnswer(h, a.n, g.halv ? g.halv.comp : 0)); break;
      case 'fyrtalVal': g.fyrtalTake(a.player); break;
      case 'chicago': botWantsChicago(h, g.players[a.player].points) ? g.bidChicago(a.player) : g.passChicago(); break;
      case 'play': g.playCard(a.player, botPlay({ hand: h, trickCards: g.trickCards, mustSuit: a.mustSuit, isBidder: g.bid === a.player, opponentBid: g.bid != null && g.bid !== a.player, trickNo: g.trickNo })); break;
      default: throw new Error('okänd action ' + a.action);
    }
    check('kortbevaring', cardCount(g) === 52, cardCount(g));
    check('inga dubblerade kort', new Set(allCards(g)).size === cardCount(g));
  }
  if (guard >= 5000) throw new Error('giv fastnade');
}
function simParty(seed, n) {
  const g = new Game(['Du', 'D1', 'D2', 'D3'].slice(0, n), mulberry32(seed));
  g.start();
  let givs = 0, halvSeen = 0, refillSeen = false, chiSeen = 0;
  while (!g.over && givs++ < 400) {
    runGiv(g);
    for (const p of g.players) {
      check('poäng är heltal', Number.isInteger(p.points), p.points);
      if (p.kopstopp) check('köpstopp först vid 45 p', p.points >= RULES.kopstopp, p.points);
    }
    if (g.awaiting && g.awaiting.player != null) check('awaiting-spelare finns', g.awaiting.player >= 0 && g.awaiting.player < n);
    halvSeen += g.halv ? 1 : 0;
    refillSeen = refillSeen || g.log.some(l => l.includes('blandas till ny talong'));
    chiSeen += g.log.filter(l => l.includes('CHICAGO')).length;
    if (!g.over) g.nextGiv();
  }
  if (g.over) {
    const top = Math.max(...g.players.map(p => p.points));
    check('vinnare har 52+ och är ensam i toppen', g.winner && g.winner.points === top && top >= RULES.target && g.players.filter(p => p.points === top).length === 1);
  }
  return { halvSeen, refillSeen, chiSeen, givs, over: g.over, g };
}
{
  let totHalv = 0, totChi = 0, totRefill = 0, capped = 0;
  for (let s = 1; s <= 300; s++) { const r = simParty(s, 2); totHalv += r.halvSeen; totChi += r.chiSeen; totRefill += r.refillSeen ? 1 : 0; if (!r.over) capped++; }
  for (let s = 1; s <= 100; s++) { const r = simParty(s + 1000, 3); totHalv += r.halvSeen; totChi += r.chiSeen; totRefill += r.refillSeen ? 1 : 0; if (!r.over) capped++; }
  for (let s = 1; s <= 60; s++) { const r = simParty(s + 5000, 4); totHalv += r.halvSeen; totChi += r.chiSeen; totRefill += r.refillSeen ? 1 : 0; if (!r.over) capped++; }
  console.log(`Simuleringar: 460 partier, halv-tillfällen: ${totHalv}, chicago-bud: ${totChi}, talongpåfyllningar: ${totRefill}, oavslutade: ${capped}`);
  check('chicago-bud förekom i simuleringarna', totChi > 0, totChi);
  check('talongpåfyllnad förekom', totRefill > 0, totRefill);
  check('inga partier fastnade', capped === 0, capped);
  const a = simParty(777, 2), b = simParty(777, 2);
  check('determinism: samma seed, samma parti', a.g.log.length === b.g.log.length && a.g.log.join('|') === b.g.log.join('|'));
}

// ============ K. Halveringsflödet som egenskapstest ============
{
  const rng = mulberry32(321);
  const rndHand = () => { const d = newDeck(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d.slice(0, 5); };
  let halvCount = 0, bad = 0, knektCount = 0, knektBad = 0;
  for (let k = 0; k < 30000; k++) {
    const handA = rndHand(), handB = rndHand();
    const evA = evaluate5(handA), evB = evaluate5(handB);
    if (!(evA.cat > 0 && evB.cat === evA.cat)) continue;
    halvCount++;
    const g = budGame();
    g.players[0].hand = handA; g.players[1].hand = handB;
    g.announceBud(0); g.announceBud(1);
    if (!(g.halv && g.halv.comp === 0)) { bad++; continue; }
    let guard = 0;
    while (g.awaiting && g.awaiting.action === 'halvAsk' && guard++ < 10) {
      g.halvAsk(1, botHalvAsk(g.players[1].hand, g.halv.comp));
      g.halvAnswer(0, botHalvAnswer(g.players[0].hand, g.awaiting.n, g.halv.comp));
    }
    const wantSign = compareHands(evB, evA) > 0 ? 1 : 0;
    if (g.budAnnounced !== wantSign || (wantSign === 1 && g.budNote !== 'övertog budet')) bad++;
    if (compareHands(evB, evA) < 0 && g.log.some(l => l.includes('har över och behåller')) === false) bad++;
    if (compareHands(evB, evA) > 0 && g.log.some(l => l.includes('tar budet')) === false) bad++;
    if (evA.tie[0] === evB.tie[0] && evA.tie.length > 1) {
      knektCount++;
      if (!g.log.some(l => l.includes('högsta kortet efteråt'))) knektBad++;
    }
    if (halvCount >= 3000) break;
  }
  check(`halveringsflödet korrekt (${halvCount} handpar)`, halvCount > 1000 && bad === 0, `${halvCount} par, ${bad} fel`);
  check(`knektvidaregången korrekt (${knektCount} lika-par)`, knektCount > 50 && knektBad === 0, `${knektCount} fall, ${knektBad} fel`);
}

console.log(failures === 0 ? `ALLA ${checks} TESTER OK` : `${failures} AV ${checks} TESTER FÖLL`);
process.exit(failures === 0 ? 0 : 1);
