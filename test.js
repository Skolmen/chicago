// Headless-tester: handutvärdering + hela simulerade partier med två botar.
import { newDeck, shuffle, evaluate5, compareHands, handPoints } from './js/poker.js';
import { Game, RULES } from './js/engine.js';
import { botExchange, botWantsChicago, botPlay, botOpenChoice } from './js/bot.js';

let failures = 0;
function check(name, cond) {
  if (!cond) { failures++; console.error('FEL:', name); }
}

const C = (r, s) => ({ r, s });
const S = 0, H = 1, D = 2, K = 3; // spader, hjärter, ruter, klöver

// Handutvärdering
check('royal SF', handPoints(evaluate5([C(14, S), C(13, S), C(12, S), C(11, S), C(10, S)])) === 52);
check('färgstege', handPoints(evaluate5([C(9, H), C(8, H), C(7, H), C(6, H), C(5, H)])) === 8);
check('fyrtal slår kåk', compareHands(evaluate5([C(4, S), C(4, H), C(4, D), C(4, K), C(2, S)]), evaluate5([C(3, S), C(3, H), C(3, D), C(8, K), C(8, S)])) > 0);
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
  if (a.action === 'chicago') return botWantsChicago(game.players[i].hand, game.players[i].points) ? game.bidChicago(i) : game.passChicago();
  if (a.action === 'play') {
    return game.playCard(i, botPlay({
      hand: game.players[i].hand, trickCards: game.trickCards, mustSuit: a.mustSuit,
      isBidder: game.bid === i, opponentBid: game.bid !== null && game.bid !== i, trickNo: game.trickNo
    }));
  }
  throw new Error('oväntad action ' + a.action);
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
