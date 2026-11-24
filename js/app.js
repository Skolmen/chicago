// Gränssnitt och spellopning för Chicago i webbläsaren.

import { Game, RULES } from './engine.js';
import { botExchange, botWantsChicago, botPlay, botOpenChoice } from './bot.js';
import { SUITS, rankLabel, cardLabel } from './poker.js';

const BOT = 1, HUMAN = 0;
const BOT_NAME = 'Datorn';

let game = null;
let selected = new Set();
let lastTrickView = null;

const el = {};
for (const id of ['phaseLabel', 'botCards', 'botInfo', 'tableMsg', 'log', 'playerCards', 'actions', 'scoreYou', 'scoreBot', 'givLabel', 'talongInfo', 'overlay', 'overlayContent', 'trickArea']) {
  el[id] = document.getElementById(id);
}

function startGame() {
  archiveCurrent(); // pågående parti hamnar i arkivet i stället för att försvinna
  game = new Game(['Du', BOT_NAME]);
  game.onEvent = handleEvent;
  selected = new Set();
  hideOverlay();
  game.start();
  render();
  saveGame();
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
  el.givLabel.textContent = `Giv ${game.giv} · ${p[game.dealer].name} ger`;
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

  // Spelade kort i sticket (pågående, annars förra sticket svagt)
  if (el.trickArea) {
    el.trickArea.innerHTML = '';
    const tcs = game.trickCards || [];
    if (tcs.length) lastTrickView = { giv: game.giv, cards: tcs.map(x => ({ player: x.player, card: { r: x.card.r, s: x.card.s } })) };
    const vis = tcs.length ? tcs : (lastTrickView && lastTrickView.giv === game.giv ? lastTrickView.cards : []);
    if (vis.length) {
      if (!tcs.length) {
        const cap = document.createElement('div');
        cap.className = 'trickCap';
        cap.textContent = 'Förra sticket';
        el.trickArea.appendChild(cap);
      }
      for (const tc of vis) {
        const wrap = document.createElement('div');
        wrap.className = 'trickSlot' + (tcs.length ? '' : ' old');
        wrap.appendChild(cardEl(tc.card));
        const lbl = document.createElement('div');
        lbl.className = 'trickName';
        lbl.textContent = p[tc.player].name;
        wrap.appendChild(lbl);
        el.trickArea.appendChild(wrap);
      }
    }
  }

  // Spelarens hand
  el.playerCards.innerHTML = '';
  const hand = p[HUMAN].hand;
  hand.forEach((card, idx) => {
    const c = cardEl(card);
    if (a && a.player === HUMAN && a.action === 'openOffer') {
      c.classList.toggle('sel', game.openOffer && game.openOffer.idx === idx);
    }
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
  if (a && a.action === 'openOffer') {
    const row = document.createElement('div');
    row.className = 'openrow';
    row.appendChild(cardEl(a.card));
    const lbl = document.createElement('span');
    lbl.textContent = 'Öppet kort' + (a.player === HUMAN ? ' — ta det eller släng det' : ' — datorn väljer');
    row.appendChild(lbl);
    el.actions.appendChild(row);
  }
  if (a && a.player === HUMAN) {
    if (a.action === 'exchange') {
      el.actions.appendChild(button(`Byt ${selected.size} kort`, selected.size ? 'primary' : '', () => {
        game.exchange(HUMAN, [...selected]);
        selected = new Set();
      }));
      if (selected.size) el.actions.appendChild(button('Rensa val', '', () => { selected = new Set(); render(); }));
      el.tableMsg.textContent = 'Välj kort att byta (eller byt inga).';
    } else if (a.action === 'openOffer') {
      el.tableMsg.textContent = 'Ta det öppna kortet, eller släng det och dra ett stängt.';
      el.actions.appendChild(button('Ta det öppna kortet', 'primary', () => { game.resolveOpen(HUMAN, true); selected = new Set(); }));
      el.actions.appendChild(button('Släng det och dra ett stängt', '', () => { game.resolveOpen(HUMAN, false); selected = new Set(); }));
    } else if (a.action === 'chicago') {
      el.tableMsg.textContent = 'Du kan buda Chicago: lova att ta alla fem stick.';
      el.actions.appendChild(button('Buda Chicago', 'primary danger', () => game.bidChicago(HUMAN)));
      el.actions.appendChild(button('Tacka nej', '', () => game.passChicago()));
    } else if (a.action === 'play') {
      el.tableMsg.textContent = a.mustSuit == null ? 'Spel ut vilket kort som helst.' : `Följ ${['spader', 'hjärter', 'ruter', 'klöver'][a.mustSuit]} om du kan.`;
    }
  } else if (a && a.action === 'nextGiv') {
    showOverlay(givSummary(), [button('Nästa giv', 'primary', () => { hideOverlay(); game.nextGiv(); })]);
  } else {
    el.tableMsg.textContent = `${p[a?.player ?? BOT].name} tänker...`;
  }
}

function scoreTableHtml() {
  const p = game.players;
  let html = `<h2>Poängtabell</h2><table class="scoretable"><tr><th>Giv</th>${p.map(x => `<th>${x.name}</th>`).join('')}</tr>`;
  game.history.forEach((row, i) => {
    html += `<tr><td>${i + 1}</td>${row.scores.map(s => `<td>${s}</td>`).join('')}</tr>`;
  });
  html += `<tr class="total"><td>Totalt</td>${p.map(x => `<td>${x.points}</td>`).join('')}</tr></table>`;
  html += `<p class="mini">Först till ${RULES.target} poäng när given är klar vinner partiet.</p>`;
  return html;
}

function givSummary() {
  const tail = game.log.slice(-6).map(l => `<div>${l}</div>`).join('');
  return `${scoreTableHtml()}<div class="mini">${tail}</div>`;
}

function showOverlay(html, buttons = []) {
  el.overlayContent.innerHTML = html;
  for (const b of buttons) el.overlayContent.appendChild(b);
  el.overlay.classList.remove('hidden');
}
function hideOverlay() { el.overlay.classList.add('hidden'); }

function showGameOver() {
  const youWon = game.winner === game.players[HUMAN];
  showOverlay(`<h2>${youWon ? 'Du vann!' : `${game.winner.name} vann`}</h2>
    <div class="scoreline"><span>Du</span><strong>${game.players[HUMAN].points} p</strong></div>
    <div class="scoreline"><span>${BOT_NAME}</span><strong>${game.players[BOT].points} p</strong></div>
    <p class="mini">Först till ${RULES.target} poäng när given är färdig.</p>`, [button('Nytt parti', 'primary', startGame)]);
}

// Botens turer körs med liten fördröjning så det känns som ett spel.
function maybeBot() {
  if (!game || game.over) return;
  const a = game.awaiting;
  if (!a) return;
  if (a.action === 'nextGiv') return;
  if (a.player !== BOT || botPending) return;
  botPending = true;
  setTimeout(() => {
    botPending = false;
    if (game.over || !game.awaiting || game.awaiting.player !== BOT) return;
    const cur = game.awaiting;
    if (cur.action === 'exchange') game.exchange(BOT, botExchange(game.players[BOT].hand));
    else if (cur.action === 'openOffer') game.resolveOpen(BOT, botOpenChoice(game.players[BOT].hand, cur.card, game.openOffer.idx));
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
  if (e.type === 'gameOver') { localStorage.removeItem(SAVE_KEY); render(); showGameOver(); return; }
  render();
  maybeBot();
  saveGame();
}

// --- Sparing i localStorage ---
const SAVE_KEY = 'chicago.sav.v1';
function saveGame() {
  try {
    if (!game || game.over) { localStorage.removeItem(SAVE_KEY); return; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.toJSON()));
  } catch (_) { /* lagring kan vara avstängd */ }
}
function restoreGame() {
  try { return Game.fromJSON(JSON.parse(localStorage.getItem(SAVE_KEY))); }
  catch (_) { return null; }
}

// --- Arkiv: flera sparade partier ---
const ARCHIVE_KEY = 'chicago.archive.v1';
function loadArchive() { try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || []; } catch (_) { return []; } }
function saveArchive(list) { try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list)); } catch (_) {} }
function archiveName(g) {
  const d = new Date();
  return `${d.toLocaleDateString('sv-SE')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · giv ${g.giv} · ${g.players[0].points}p-${g.players[1].points}p`;
}
function archiveCurrent() {
  if (!game || game.over) return false;
  const list = loadArchive();
  list.unshift({ name: archiveName(game), savedAt: Date.now(), data: game.toJSON() });
  if (list.length > 12) list.length = 12; // äldsta sparningen släpps ut
  saveArchive(list);
  return true;
}
function openArchived(item) {
  const g = Game.fromJSON(item.data);
  if (!g) return false;
  game = g; game.onEvent = handleEvent;
  hideOverlay(); render(); maybeBot(); saveGame();
  return true;
}
function showArchive() {
  const list = loadArchive();
  const btns = [];
  list.forEach((item, i) => {
    btns.push(button(`Öppna ${i + 1}: ${item.name}`, i === 0 ? 'primary' : '', () => { openArchived(item); }));
    btns.push(button(`Ta bort ${i + 1}`, 'danger', () => { const l = loadArchive(); l.splice(i, 1); saveArchive(l); showArchive(); }));
  });
  btns.push(button('Tillbaka till menyn', 'primary', () => showMenu()));
  showOverlay(`<h2>Arkiv</h2>${list.length ? '' : '<p class="mini">Inga sparade partier.</p>'}`, btns);
}

// --- Meny ---
function showMenu(title) {
  const hasSave = !!restoreGame();
  const btns = [];
  if (hasSave) btns.push(button('Fortsätt sparade partiet', 'primary', () => {
    const g = restoreGame();
    if (g) { game = g; game.onEvent = handleEvent; }
    hideOverlay(); render(); maybeBot(); saveGame();
  }));
  if (game && !game.over) btns.push(button('Poängtabell', '', () => showOverlay(scoreTableHtml(), [button('Tillbaka till menyn', '', () => showMenu(title))])));
  if (game && !game.over) btns.push(button('Spara parti i arkivet', '', () => { archiveCurrent(); showMenu('Sparat i arkivet'); }));
  btns.push(button(loadArchive().length ? `Arkiv (${loadArchive().length})` : 'Arkiv', '', () => showArchive()));
  btns.push(button('Nytt parti', hasSave ? '' : 'primary', () => { hideOverlay(); startGame(); }));
  btns.push(button('Stäng', '', () => { hideOverlay(); render(); }));
  showOverlay(`<h2>${title || 'Meny'}</h2>`, btns);
}

// --- Vakt: om en händelse skulle gå förlorad körs datorns tur ändå ---
let botPending = false;
setInterval(() => { if (game && !game.over) maybeBot(); }, 1200);

function boot() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  el.menuBtn = document.getElementById('menuBtn');
  if (el.menuBtn) el.menuBtn.addEventListener('click', () => showMenu());
  const saved = restoreGame();
  if (saved && !saved.over) {
    game = saved; game.onEvent = handleEvent;
    hideOverlay(); render(); maybeBot(); saveGame();
    showMenu('Välkommen tillbaka');
  } else {
    startGame();
  }
}

boot();
