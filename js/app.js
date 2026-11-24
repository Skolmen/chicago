// Gränssnitt och spellopning för Chicago i webbläsaren.

import { Game, RULES } from './engine.js';
import { botExchange, botWantsChicago, botPlay } from './bot.js';
import { SUITS, rankLabel, cardLabel } from './poker.js';

const BOT = 1, HUMAN = 0;
const BOT_NAME = 'Datorn';

let game = null;
let selected = new Set();

const el = {};
for (const id of ['phaseLabel', 'botCards', 'botInfo', 'tableMsg', 'log', 'playerCards', 'actions', 'scoreYou', 'scoreBot', 'givLabel', 'talongInfo', 'overlay', 'overlayContent']) {
  el[id] = document.getElementById(id);
}

function startGame() {
  game = new Game(['Du', BOT_NAME]);
  game.onEvent = handleEvent;
  selected = new Set();
  hideOverlay();
  game.start();
  render();
}

function cardEl(card, opts = {}) {
  const d = document.createElement('div');
  d.className = 'card' + (card.s === 1 || card.s === 2 ? ' red' : '');
  d.innerHTML = `<span class="corner">${rankLabel(card.r)}<br>${SUITS[card.s]}</span><span class="suit">${SUITS[card.s]}</span><span class="corner b">${rankLabel(card.r)}<br>${SUITS[card.s]}</span>`;
  return d;
}

function backEl() {
  const d = document.createElement('div');
  d.className = 'card back';
  d.innerHTML = '<span class="suit">✦</span>';
  return d;
}

function button(label, cls, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = 'btn ' + (cls || '');
  b.addEventListener('click', fn);
  return b;
}

function render() {
  if (!game) return;
  const p = game.players, a = game.awaiting;
  el.givLabel.textContent = `Giv ${game.giv}`;
  el.scoreYou.textContent = `${p[HUMAN].name}: ${p[HUMAN].points} p` + (p[HUMAN].kopstopp ? ' (köpstopp)' : '');
  el.scoreBot.textContent = `${p[BOT].name}: ${p[BOT].points} p`;
  const phaseNames = { kop1: 'Köp 1', kop2: 'Köp 2', kop3: 'Köp 3', chicago: 'Chicago-bud?', tricks: 'Stickspel', givEnd: 'Given avslutad' };
  el.phaseLabel.textContent = (phaseNames[game.phase] || '') + (game.bid !== null && game.bid !== undefined ? ` – ${p[game.bid].name} har budat Chicago` : '');
  el.talongInfo && (el.talongInfo.textContent = `Talong: ${game.talong.length} kort`);

  // Botens hand
  el.botCards.innerHTML = '';
  const botCount = p[BOT].hand.length;
  for (let i = 0; i < botCount; i++) el.botCards.appendChild(backEl());

  // Loggen (senaste raderna)
  el.log.innerHTML = '';
  for (const line of game.log.slice(-4)) {
    const d = document.createElement('div');
    d.textContent = line;
    el.log.appendChild(d);
  }

  // Spelarens hand
  el.playerCards.innerHTML = '';
  const hand = p[HUMAN].hand;
  hand.forEach((card, idx) => {
    const c = cardEl(card);
    if (a && a.player === HUMAN) {
      if (a.action === 'exchange') {
        c.classList.toggle('sel', selected.has(idx));
        c.addEventListener('click', () => { selected.has(idx) ? selected.delete(idx) : selected.add(idx); render(); });
      } else if (a.action === 'play') {
        const legal = a.mustSuit == null || card.s === a.mustSuit || !hand.some(x => x.s === a.mustSuit);
        if (legal) c.addEventListener('click', () => game.playCard(HUMAN, idx));
        else c.classList.add('dim');
      }
    }
    el.playerCards.appendChild(c);
  });

  // Knappar
  el.actions.innerHTML = '';
  if (game.over) return;
  if (a && a.player === HUMAN) {
    if (a.action === 'exchange') {
      el.actions.appendChild(button(`Byt ${selected.size} kort`, selected.size ? 'primary' : '', () => {
        game.exchange(HUMAN, [...selected]);
        selected = new Set();
      }));
      if (selected.size) el.actions.appendChild(button('Rensa val', '', () => { selected = new Set(); render(); }));
      el.tableMsg.textContent = 'Välj kort att byta (eller byt inga).';
    } else if (a.action === 'chicago') {
      el.tableMsg.textContent = 'Du kan buda Chicago: lova att ta alla fem stick.';
      el.actions.appendChild(button('Buda Chicago', 'primary danger', () => game.bidChicago(HUMAN)));
      el.actions.appendChild(button('Tacka nej', '', () => game.passChicago()));
    } else if (a.action === 'play') {
      el.tableMsg.textContent = a.mustSuit == null ? 'Spel ut vilket kort som helst.' : `Följ ${['spader', 'hjärter', 'ruter', 'klöver'][a.mustSuit]} om du kan.`;
    }
  } else if (a && a.action === 'nextGiv') {
    showOverlay(givSummary());
    el.actions.appendChild(button('Nästa giv', 'primary', () => { hideOverlay(); game.nextGiv(); }));
  } else {
    el.tableMsg.textContent = `${p[a?.player ?? BOT].name} tänker...`;
  }
}

function givSummary() {
  const rows = game.players.map(x => `<div class="scoreline"><span>${x.name}</span><strong>${x.points} p</strong></div>`).join('');
  const tail = game.log.slice(-6).map(l => `<div>${l}</div>`).join('');
  return `<h2>Giv ${game.giv} är klar</h2>${rows}<div class="mini">${tail}</div>`;
}

function showOverlay(html) { el.overlayContent.innerHTML = html; el.overlay.classList.remove('hidden'); }
function hideOverlay() { el.overlay.classList.add('hidden'); }

function showGameOver() {
  const youWon = game.winner === game.players[HUMAN];
  showOverlay(`<h2>${youWon ? 'Du vann!' : `${game.winner.name} vann`}</h2>
    <div class="scoreline"><span>Du</span><strong>${game.players[HUMAN].points} p</strong></div>
    <div class="scoreline"><span>${BOT_NAME}</span><strong>${game.players[BOT].points} p</strong></div>
    <p class="mini">Först till ${RULES.target} poäng när given är färdig.</p>`);
  el.actions.innerHTML = '';
  el.actions.appendChild(button('Nytt parti', 'primary', startGame));
}

// Botens turer körs med liten fördröjning så det känns som ett spel.
function maybeBot() {
  if (!game || game.over) return;
  const a = game.awaiting;
  if (!a) return;
  if (a.action === 'nextGiv') return;
  if (a.player !== BOT) return;
  setTimeout(() => {
    if (game.over || !game.awaiting || game.awaiting.player !== BOT) return;
    const cur = game.awaiting;
    if (cur.action === 'exchange') game.exchange(BOT, botExchange(game.players[BOT].hand));
    else if (cur.action === 'chicago') botWantsChicago(game.players[BOT].hand, game.players[BOT].points) ? game.bidChicago(BOT) : game.passChicago();
    else if (cur.action === 'play') {
      const i = botPlay({
        hand: game.players[BOT].hand,
        trickCards: game.trickCards,
        mustSuit: cur.mustSuit,
        isBidder: game.bid === BOT,
        opponentBid: game.bid === HUMAN,
        trickNo: game.trickNo
      });
      game.playCard(BOT, i);
    }
  }, 650);
}

function handleEvent(e) {
  if (e.type === 'gameOver') { render(); showGameOver(); return; }
  render();
  maybeBot();
}

startGame();
