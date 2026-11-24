// Headless-tester: handutvärdering + hela simulerade partier med två botar.
import { newDeck, shuffle, evaluate5, compareHands, handPoints } from './js/poker.js';
import { Game, RULES } from './js/engine.js';
import { botExchange, botWantsChicago, botPlay } from './js/bot.js';

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
