// Headless-tester: handutvärdering + hela simulerade partier med två botar.
import { newDeck, shuffle, evaluate5, compareHands, handPoints } from './js/poker.js';
import { Game, RULES } from './js/engine.js';
import { botExchange, botWantsChicago, botPlay, botOpenChoice, botBud } from './js/bot.js';

let failures = 0;
function check(name, cond) {
  if (!cond) { failures++; console.error('FEL:', name); }
}

const C = (r, s) => ({ r, s });
const S = 0, H = 1, D = 2, K = 3; // spader, hjärter, ruter, klöver

// Handutvärdering
check('royal SF', handPoints(evaluate5([C(14, S), C(13, S), C(12, S), C(11, S), C(10, S)])) === 52);
check('färgstege 52', handPoints(evaluate5([C(9, H), C(8, H), C(7, H), C(6, H), C(5, H)])) === 52);
check('fyrtal slår kåk', compareHands(evaluate5([C(4, S), C(4, H), C(4, D), C(4, K), C(2, S)]), evaluate5([C(3, S), C(3, H), C(3, D), C(8, K), C(8, S)])) > 0);
check('fyrtal 8 p', handPoints(evaluate5([C(4, S), C(4, H), C(4, D), C(4, K), C(2, S)])) === 8);
check('stege wheel', evaluate5([C(14, S), C(2, H), C(3, D), C(4, K), C(5, S)]).cat === 4);
check('stege wheel slår inte 6-hög', compareHands(evaluate5([C(14, S), C(2, H), C(3, D), C(4, K), C(5, S)]), evaluate5([C(6, S), C(7, H), C(8, D), C(9, K), C(10, S)])) < 0);
check('par', evaluate5([C(14, S), C(14, H), C(3, D), C(7, K), C(9, S)]).cat === 1);
check('hög hand 0 p', handPoints(evaluate5([C(14, S), C(12, H), C(9, D), C(7, K), C(3, S)])) === 0);
check('färg slår stege', compareHands(evaluate5([C(14, S), C(12, S), C(9, S), C(7, S), C(3, S)]), evaluate5([C(14, S), C(12, H), C(11, D), C(10, K), C(9, S)])) > 0);
check('exakt lika', compareHands(evaluate5([C(14, S), C(12, H), C(9, D), C(7, K), C(3, S)]), evaluate5([C(14, H), C(12, D), C(9, K), C(7, S), C(3, H)])) === 0);

// Simuleringar
function botMoveFor(i, game) {
  const a = game.awaiting;
  if (a.action === 'exchange') return game.exchange(i, botExchange(game.players[i].hand));
  if (a.action === 'openOffer') return game.resolveOpen(i, botOpenChoice(game.players[i].hand, a.card, game.openOffer.idx));
  if (a.action === 'bud') { const c = botBud(game.players[i].hand, a.bestCat, a.bestEv); return c != null ? game.announceBud(i) : game.budPass(i); }
  if (a.action === 'fyrtalVal') return game.fyrtalTake(i);
  if (a.action === 'chicago') return botWantsChicago(game.players[i].hand, game.players[i].points) ? game.bidChicago(i) : game.passChicago();
  if (a.action === 'play') {
    return game.playCard(i, botPlay({
      hand: game.players[i].hand, trickCards: game.trickCards, mustSuit: a.mustSuit,
      isBidder: game.bid === i, opponentBid: game.bid !== null && game.bid !== i, trickNo: game.trickNo
    }));
  }
  throw new Error('oväntad action ' + a.action);
}

for (let seed = 0; seed < 40; seed++) {
  let rng = mulberry32(seed * 104729 + 7);
  const game = new Game(['A', 'B', 'C'], rng);
  let guard = 0;
  game.start();
  while (!game.over && guard++ < 3000) {
    const a = game.awaiting;
    if (!a) throw new Error('stilla utan att vara över, giv ' + game.giv + ' fas ' + game.phase);
    if (a.action === 'nextGiv') { game.nextGiv(); continue; }
    botMoveFor(a.player, game);
  }
  check(`spel 3p ${seed} avslutas`, game.over);
  check(`spel 3p ${seed} vinnare >=52`, game.winner && game.winner.points >= RULES.target);
}

for (let seed = 0; seed < 40; seed++) {
  let rng = mulberry32(seed * 15485863 + 3);
  const game = new Game(['A', 'B', 'C', 'D'], rng);
  let guard = 0;
  game.start();
  while (!game.over && guard++ < 3000) {
    const a = game.awaiting;
    if (!a) throw new Error('stilla utan att vara över, giv ' + game.giv + ' fas ' + game.phase);
    if (a.action === 'nextGiv') { game.nextGiv(); continue; }
    botMoveFor(a.player, game);
  }
  check(`spel 4p ${seed} avslutas`, game.over);
  check(`spel 4p ${seed} vinnare >=52`, game.winner && game.winner.points >= RULES.target);
}

for (let seed = 0; seed < 300; seed++) {
  let rng = mulberry32(seed * 7919 + 13);
  const game = new Game(['A', 'B'], rng);
  let guard = 0;
  game.start();
  while (!game.over && guard++ < 3000) {
    const a = game.awaiting;
    if (!a) throw new Error('stilla utan att vara över, giv ' + game.giv + ' fas ' + game.phase);
    if (a.action === 'nextGiv') { game.nextGiv(); continue; }
    botMoveFor(a.player, game);
  }
  check(`spel ${seed} avslutas`, game.over);
  check(`spel ${seed} vinnare >=52`, game.winner && game.winner.points >= RULES.target);
  for (const p of game.players) check(`spel ${seed} ${p.name} poäng >= -15`, p.points >= -RULES.chicagoLoss);
  check(`spel ${seed} givantal rimligt`, game.giv < 200);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Budgivning (issue 47)
{
  // Förhand budar först, senare bud måste slå, poängen går till bäst bud
  const g = new Game(['Du', 'Datorn']);
  g.onEvent = () => {};
  g.giv = 1; g.phase = 'kop1'; g.dealer = 1; // Datorn ger, Du (förhand) säger först
  g.exchanged = new Set([0, 1]);
  g.players[0].hand = [C(9, S), C(9, H), C(3, D), C(7, K), C(11, S)]; // par
  g.players[1].hand = [C(5, S), C(5, H), C(5, D), C(7, K), C(11, S)]; // triss
  g.beginBud('efter första bytet', 'kop2');
  check('budfas pågår', g.phase === 'bud' && g.awaiting && g.awaiting.action === 'bud' && g.awaiting.player === 0);
  check('förhand budar först', g.budOrder[0] === 0);
  g.announceBud(0);
  check('par budat', g.budCat === 1 && g.budAnnounced === 0);
  check('turen går vidare', g.awaiting && g.awaiting.player === 1);
  g.announceBud(1);
  check('poäng till trisshanden', g.players[1].points === 3 && g.players[0].points === 0);
  check('vidare till andra bytet', g.budWhen === 'efter andra bytet' && g.phase === 'bud');
  g.announceBud(0); // par igen i andra budet
  g.announceBud(1); // triss
  check('två handpoäng utdelade', g.players[1].points === 6);
  g.exchange(0, []); g.exchange(1, []); // tredje bytet sker utan budgivning
  check('inget bud efter sista bytet, direkt till utspelet', g.phase === 'tricks' || g.phase === 'chicago');
}
{
  // Utan par eller bättre får man vara tyst; alla tysta = ingen poäng
  const g = new Game(['Du', 'Datorn']);
  g.onEvent = () => {};
  g.giv = 1; g.phase = 'kop2'; g.dealer = 0; // Du ger, Datorn säger först
  g.exchanged = new Set([0, 1]);
  g.players[0].hand = [C(2, S), C(4, H), C(6, D), C(7, K), C(11, S)]; // högkort
  g.players[1].hand = [C(3, S), C(5, H), C(9, D), C(8, K), C(12, S)]; // högkort
  g.beginBud('efter andra bytet', 'kop3');
  g.budPass(1);
  g.budPass(0);
  check('alla tysta ger ingen poäng', g.players[0].points === 0 && g.players[1].points === 0);
  check('ingen bjuder, giv:en fortsätter', g.phase !== 'bud' && g.phase !== 'kop3');
}
{
  // Lika hand slår inte: första budande behåller
  const g = new Game(['Du', 'Datorn']);
  g.onEvent = () => {};
  g.giv = 1; g.phase = 'kop1'; g.dealer = 1; g.chicagoAsked = new Set();
  g.exchanged = new Set([0, 1]);
  g.players[0].hand = [C(9, S), C(9, H), C(3, D), C(7, K), C(11, S)];
  g.players[1].hand = [C(5, S), C(5, H), C(3, D), C(7, K), C(11, S)]; // också par
  g.beginBud('efter första bytet', 'kop2');
  g.announceBud(0);
  g.announceBud(1); // likavärdigt, blir tyst
  check('likavärdigt slår inte, första behåller', g.players[0].points === 1 && g.players[1].points === 0 && g.budWhen === 'efter andra bytet');
}
{
  // Spara/ladda mitt i budgivningen
  const g = new Game(['Du', 'Datorn']);
  g.onEvent = () => {};
  g.giv = 1; g.phase = 'kop1'; g.dealer = 1; g.chicagoAsked = new Set();
  g.exchanged = new Set([0, 1]);
  g.players[0].hand = [C(9, S), C(9, H), C(3, D), C(7, K), C(11, S)];
  g.players[1].hand = [C(5, S), C(5, H), C(5, D), C(7, K), C(11, S)];
  g.beginBud('efter första bytet', 'kop2');
  g.announceBud(0);
  const g2 = Game.fromJSON(g.toJSON());
  check('budfasen klarar sparning', g2.phase === 'bud' && g2.awaiting && g2.awaiting.action === 'bud' && g2.awaiting.player === 1 && g2.budCat === 1);
  g2.announceBud(1);
  check('bud klart efter laddning', g2.players[1].points === 3 && g2.budWhen === 'efter andra bytet');
}
// Tjuvpassförbud och högre par vid samma kategori (issue 49)
{
  const g = new Game(['Du', 'Datorn']);
  g.onEvent = () => {};
  g.giv = 1; g.phase = 'kop1'; g.dealer = 1;
  g.exchanged = new Set([0, 1]);
  g.players[0].hand = [C(5, S), C(5, H), C(3, D), C(7, K), C(11, S)]; // par 5:or
  g.players[1].hand = [C(9, S), C(9, H), C(3, D), C(7, K), C(11, S)]; // par 9:or
  g.beginBud('efter första bytet', 'kop2');
  g.announceBud(0); // par
  g.announceBud(1); // högre par övertar
  check('poängen går till det högre paret', g.players[1].points === 1 && g.players[0].points === 0);
  check('övertaget syns i loggen', g.log.some(l => l.includes('Datorn säger Par (högre än Du).')));
}
{
  const g = new Game(['Du', 'Datorn']);
  g.onEvent = () => {};
  g.giv = 1; g.phase = 'kop1'; g.dealer = 1;
  g.exchanged = new Set([0, 1]);
  g.players[0].hand = [C(5, S), C(5, H), C(3, D), C(7, K), C(11, S)]; // par
  g.players[1].hand = [C(2, S), C(4, H), C(6, D), C(8, K), C(12, S)]; // högt utan par
  g.beginBud('efter första bytet', 'kop2');
  const logLen = g.log.length;
  g.budPass(0); // har par: tjuvpassning vägras
  check('tjuvpass vägras', g.awaiting && g.awaiting.action === 'bud' && g.awaiting.player === 0 && g.log.length === logLen + 1);
  g.announceBud(0); // tvingas säga par
  g.budPass(1);
  check('par måste sägas', g.players[0].points === 1);
  check('giv:en fortsätter efter budet', g.phase === 'bud' && g.budWhen === 'efter andra bytet');
}
{
  // Fyrtal: 8 p eller nollställ alla, en gång per parti
  const g = new Game(['Du', 'Datorn']);
  g.onEvent = () => {};
  g.giv = 1; g.phase = 'kop1'; g.dealer = 1;
  g.exchanged = new Set([0, 1]);
  g.players[0].hand = [C(5, S), C(5, H), C(5, D), C(5, K), C(11, S)]; // fyrtal
  g.players[1].hand = [C(2, S), C(4, H), C(6, D), C(8, K), C(12, S)];
  g.players[0].points = 10; g.players[1].points = 7;
  g.beginBud('efter första bytet', 'kop2');
  g.announceBud(0); // fyrtal
  g.announceBud(1); // tyst
  check('fyrtal väntar på val', g.phase === 'fyrtalVal' && g.awaiting && g.awaiting.action === 'fyrtalVal' && g.awaiting.player === 0);
  g.fyrtalZero(0);
  check('nollställning sätter alla på noll', g.players[0].points === 0 && g.players[1].points === 0 && g.fyrtalZeroUsed === true);
  check('spel fortsätter efter nollställning', g.phase === 'bud' && g.budWhen === 'efter andra bytet');
  g.announceBud(0); // fyrtal igen: bara poäng nu
  g.announceBud(1);
  check('andra fyrtal ger 8 p direkt', g.players[0].points === 8 && g.phase === 'kop3');
}
console.log(failures === 0 ? 'ALLA TESTER OK' : `${failures} FEL`);
process.exit(failures === 0 ? 0 : 1);

// Test: spara och ladda parti
{
  const g = new Game(['Du', 'Datorn']);
  g.onEvent = () => {};
  g.start();
  g.exchange(0, [0, 1]);
  g.exchange(1, [2]);
  g.playCard(0, 0);
  const d = JSON.parse(JSON.stringify(g.toJSON()));
  if (d.v !== 1 || d.players.length !== 2) throw new Error('toJSON fält saknas');
  const g2 = Game.fromJSON(d);
  if (JSON.stringify(g2.toJSON()) !== JSON.stringify(g.toJSON())) throw new Error('round trip misslyckades');
  if (g2.players[0].hand.length !== g.players[0].hand.length) throw new Error('handlängder skiljer');
  if (g2.phase !== g.phase) throw new Error('fas skiljer');
  // laddat parti ska kunna fortsätta till klart slut
  let guard = 0;
  while (!g2.over && guard++ < 500) {
    const a = g2.awaiting;
    if (!a) break;
    if (a.action === 'exchange') g2.exchange(a.player, a.player === 0 ? [] : [0]);
    else if (a.action === 'bud') botBud(g2.players[a.player].hand, a.bestCat, a.bestEv) != null ? g2.announceBud(a.player) : g2.budPass(a.player);
    else if (a.action === 'fyrtalVal') g2.fyrtalTake(a.player);
    else if (a.action === 'chicago') a.player === 0 ? g2.passChicago() : g2.bidChicago(1);
    else if (a.action === 'nextGiv') g2.nextGiv();
    else {
      const p = g2.players[a.player];
      const legal = a.mustSuit == null ? p.hand : (p.hand.some(c => c.s === a.mustSuit) ? p.hand.filter(c => c.s === a.mustSuit) : p.hand);
      g2.playCard(a.player, p.hand.indexOf(legal[0]));
    }
  }
  if (!g2.over) throw new Error('laddat parti kom inte i mål');
  console.log('OK: spara/ladda-rundtrip och fortsatt parti');
}

// Test: poängtabellen fylls per giv
{
  const g = new Game(['Du', 'Datorn']);
  g.onEvent = () => {};
  g.start();
  let guard = 0;
  while (!g.over && guard++ < 500) {
    const a = g.awaiting;
    if (!a) break;
    if (a.action === 'exchange') g.exchange(a.player, []);
    else if (a.action === 'chicago') g.passChicago();
    else if (a.action === 'nextGiv') g.nextGiv();
    else {
      const p = g.players[a.player];
      const legal = a.mustSuit == null ? p.hand : (p.hand.some(c => c.s === a.mustSuit) ? p.hand.filter(c => c.s === a.mustSuit) : p.hand);
      g.playCard(a.player, p.hand.indexOf(legal[0]));
    }
  }
  if (!g.over) throw new Error('partiet kom inte i mål (tabelltest)');
  if (!Array.isArray(g.history) || g.history.length < 2) throw new Error('poängtabellen saknar givrader');
  if (g.history[g.history.length - 1].scores.length !== 2) throw new Error('fel antal kolumner i tabellen');
  const rt = Game.fromJSON(JSON.parse(JSON.stringify(g.toJSON())));
  if (rt.history.length !== g.history.length) throw new Error('historien följer inte med i sparningen');
  console.log('OK: poängtabell per giv + sparning');
}

// Ett öppet: erbjuds vid byte av exakt ett kort
{
  const g = new Game(['Du', 'Datorn'], mulberry32(1));
  g.giv = 1; g.phase = 'kop1';
  g.players[0].hand = [C(2, S), C(3, H), C(5, D), C(9, K), C(11, S)];
  g.talong = [C(4, S), C(7, D), C(14, S)];
  g.awaiting = { player: 0, action: 'exchange' };
  g.exchange(0, [1]);
  check('öppet erbjuds', !!g.awaiting && g.awaiting.action === 'openOffer' && g.awaiting.card.r === 14 && g.awaiting.card.s === S);
  g.resolveOpen(0, true);
  check('öppet taget: 5 kort, byte på plats', g.players[0].hand.length === 5 && g.players[0].hand.some(c => c.r === 14 && c.s === S) && !g.players[0].hand.some(c => c.r === 3 && c.s === H));
  check('kastat kortet i kasthögen', g.discard.length === 1 && g.discard[0].r === 3 && g.discard[0].s === H);
  check('byt registrerat', g.exchanged.has(0));
}
{
  const g = new Game(['Du', 'Datorn'], mulberry32(1));
  g.giv = 1; g.phase = 'kop1';
  g.players[0].hand = [C(2, S), C(3, H), C(5, D), C(9, K), C(11, S)];
  g.talong = [C(4, S), C(14, S)];
  g.awaiting = { player: 0, action: 'exchange' };
  g.exchange(0, [4]);
  g.resolveOpen(0, false);
  check('nekat öppet: fick stängt kort i stället', g.players[0].hand.length === 5 && g.players[0].hand.some(c => c.r === 4) && !g.players[0].hand.some(c => c.r === 14));
  check('öppna kortet slängt', g.discard.some(c => c.r === 14) && g.talong.length === 0);
}
{
  const g = new Game(['Du', 'Datorn'], mulberry32(1));
  g.giv = 1; g.phase = 'kop1';
  g.players[0].hand = [C(2, S), C(3, H), C(5, D), C(9, K), C(11, S)];
  g.talong = [C(4, S), C(6, D), C(8, K), C(10, S), C(12, H)];
  g.awaiting = { player: 0, action: 'exchange' };
  g.exchange(0, [0, 1]);
  check('flerkortsbyte utan öppet', !g.awaiting || g.awaiting.action !== 'openOffer');
  check('flerkortsbyte drar stängt', g.players[0].hand.length === 5 && g.talong.length === 3);
}
{
  // spara och ladda mitt i erbjudandet
  const g = new Game(['Du', 'Datorn'], mulberry32(1));
  g.giv = 1; g.phase = 'kop1';
  g.players[0].hand = [C(2, S), C(3, H), C(5, D), C(9, K), C(11, S)];
  g.talong = [C(4, S), C(7, D), C(14, S)];
  g.awaiting = { player: 0, action: 'exchange' };
  g.exchange(0, [2]);
  const g2 = Game.fromJSON(g.toJSON());
  check('öppet överlever sparning', g2.awaiting && g2.awaiting.action === 'openOffer' && g2.openOffer.card.r === 14);
  g2.resolveOpen(0, true);
  check('efter laddning: öppet kan tas', g2.players[0].hand.length === 5 && g2.players[0].hand.some(c => c.r === 14));
}
// Botens val: öppet kort som behåller kategorin tas
check('bot tar gynnande öppet', botOpenChoice([C(5, S), C(5, H), C(9, D), C(11, K), C(2, S)], C(5, D), 4) === true);
check('bot nekar sämre öppet', botOpenChoice([C(5, S), C(5, H), C(9, D), C(11, K), C(13, S)], C(3, K), 4) === false);
{
  // skräphögen blandas när talongen tar slut (issue 38)
  const g = new Game(['Du', 'Datorn'], mulberry32(7));
  g.giv = 1; g.phase = 'kop1';
  g.players[0].hand = [C(2, S), C(3, H), C(5, D), C(9, K), C(11, S)];
  g.talong = [C(4, S)];
  g.discard = [C(6, D), C(8, K), C(10, S), C(12, H), C(13, D), C(15, K)];
  g.awaiting = { player: 0, action: 'exchange' };
  const logBefore = g.log.length;
  g.exchange(0, [0, 1, 2]);
  check('skräphögen blandas', g.log.some(l => l.includes('blandas')));
  check('handen fylld igen', g.players[0].hand.length === 5);
  check('talong fylld om från skräphögen', g.talong.length === 7);
  check('discard tömd', g.discard.length === 0);
}
