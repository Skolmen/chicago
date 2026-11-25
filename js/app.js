// Gränssnitt och spellopning för Chicago i webbläsaren.

import { Game, RULES } from './engine.js';
import { botExchange, botWantsChicago, botPlay, botOpenChoice, botBud } from './bot.js';
import { SUITS, rankLabel, cardLabel, evaluate5, handName, compareHands } from './poker.js';

const HUMAN = 0;
const BOT_NAMES = ['Datorn', 'Datorn 2', 'Datorn 3'];
const OPP_KEY = 'chicago.opp.v1';
function chosenOpponents() {
  try { return Math.min(3, Math.max(1, parseInt(localStorage.getItem(OPP_KEY), 10) || 1)); }
  catch (_) { return 1; }
}

let game = null;
let selected = new Set();
let lastTrickView = null;

const el = {};
for (const id of ['phaseLabel', 'botArea', 'tableMsg', 'log', 'playerCards', 'actions', 'givLabel', 'talongInfo', 'overlay', 'overlayContent', 'trickArea', 'playerChips', 'logDrawer', 'logBackdrop', 'logClose', 'openCard', 'menuDot']) {
  el[id] = document.getElementById(id);
}

function startGame() {
  archiveCurrent(); // pågående parti hamnar i arkivet i stället för att försvinna
  game = new Game(['Du', ...BOT_NAMES.slice(0, chosenOpponents())]);
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
  const phaseNames = { kop1: 'Köp 1', kop2: 'Köp 2', kop3: 'Köp 3', bud: 'Budgivning', fyrtalVal: 'Fyrtal eller nollställ', chicago: 'Chicago-bud?', tricks: 'Stickspel', givEnd: 'Given avslutad' };
  el.phaseLabel.textContent = (phaseNames[game.phase] || '') + (game.bid !== null && game.bid !== undefined ? ` – ${p[game.bid].name} har budat Chicago` : '');
  el.talongInfo && (el.talongInfo.textContent = `Talong: ${game.talong.length} kort`);

  // Spelarchips: namn och poäng runt spelplanen, aktiv spelare lyfts
  if (el.playerChips) {
    el.playerChips.innerHTML = '';
    p.forEach((pl, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip' + (a && a.player === i && a.action !== 'nextGiv' ? ' active' : '');
      chip.textContent = `${pl.name} · ${pl.points} p` + (pl.kopstopp ? ' 🔒' : '');
      el.playerChips.appendChild(chip);
    });
  }

  // Datorernas händer (en rad per datorspelare)
  el.botArea.innerHTML = '';
  for (let i = 1; i < p.length; i++) {
    const row = document.createElement('div');
    row.className = 'botRow';
    const lbl = document.createElement('span');
    lbl.className = 'botLabel';
    lbl.textContent = `${p[i].name} · ${p[i].hand.length} kort` + (a && a.player === i ? ' · tänker...' : '');
    row.appendChild(lbl);
    const cards = document.createElement('div');
    cards.className = 'botCards';
    for (let k = 0; k < p[i].hand.length; k++) cards.appendChild(backEl());
    row.appendChild(cards);
    el.botArea.appendChild(row);
  }

  // Loggen: sidomeny, prick på menyknappen vid nyheter
  el.log.innerHTML = '';
  for (const line of game.log) {
    const d = document.createElement('div');
    d.textContent = line;
    el.log.appendChild(d);
  }
  el.log.scrollTop = el.log.scrollHeight;
  if (el.menuDot) el.menuDot.classList.toggle('hidden', !(game.log.length > lastSeenLog));

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
        wrap.className = 'trickSlot' + (tcs.length ? '' : ' old') + (a && a.player === tc.player ? ' turn' : '');
        wrap.appendChild(cardEl(tc.card));
        const lbl = document.createElement('div');
        lbl.className = 'trickName';
        lbl.textContent = p[tc.player].name;
        wrap.appendChild(lbl);
        el.trickArea.appendChild(wrap);
      }
    }
  }

  // Öppet kort mitt på spelplanen
  if (el.openCard) {
    el.openCard.innerHTML = '';
    if (a && a.action === 'openOffer') {
      const lbl = document.createElement('span');
      lbl.className = 'openlbl';
      lbl.textContent = 'Öppet kort' + (a.player === HUMAN ? ' — ta det eller släng det' : ' — datorn väljer...');
      const oc = cardEl(a.card);
      if (a.player !== HUMAN) oc.classList.add('botThink');
      el.openCard.appendChild(lbl);
      el.openCard.appendChild(oc);
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
  if (a && a.action === 'fyrtalVal' && a.player === HUMAN) {
    el.tableMsg.textContent = game.fyrtalZeroUsed ? `Fyrtal: ta ${game.fyrtalPending.pts} p.` : 'Fyrtal! Ta poängen, eller nollställ alla poäng (bara en gång per parti).';
    el.actions.appendChild(button(`Ta ${game.fyrtalPending.pts} p`, 'primary', () => game.fyrtalTake(HUMAN)));
    if (!game.fyrtalZeroUsed) el.actions.appendChild(button('Nollställ alla poäng', 'danger', () => game.fyrtalZero(HUMAN)));
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
    } else if (a.action === 'bud') {
      const mine = evaluate5(game.players[HUMAN].hand);
      const bestEv = a.bestEv || null;
      const kanBjuda = a.bestCat === 0 ? mine.cat > 0 : (mine.cat > a.bestCat || (mine.cat === a.bestCat && bestEv && compareHands(mine, bestEv) > 0));
      el.tableMsg.textContent = (a.bestName ? `Redan sagt: ${a.bestName}. ` : 'Ingen har sagt något ännu. ') + (kanBjuda ? 'Tjuvpassning är förbjuden, du måste säga.' : 'Du kan vara tyst.');
      if (kanBjuda) el.actions.appendChild(button(`Säg ${handName(mine)}`, 'primary', () => game.announceBud(HUMAN)));
      else el.actions.appendChild(button('Tyst', '', () => game.budPass(HUMAN)));
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
    el.tableMsg.textContent = `${p[a?.player ?? 1].name} tänker...`;
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
  const rows = game.players.map(pl =>
    `<div class="scoreline${pl === game.winner ? ' win' : ''}"><span>${pl.name}</span><strong>${pl.points} p</strong></div>`).join('');
  showOverlay(`<h2>${youWon ? 'Du vann!' : `${game.winner.name} vann`}</h2>${rows}
    <p class="mini">Först till ${RULES.target} poäng när given är färdig.</p>`, [button('Nytt parti', 'primary', startGame)]);
}

// Botens turer körs med liten fördröjning så det känns som ett spel.
function maybeBot() {
  if (!game || game.over) return;
  const a = game.awaiting;
  if (!a) return;
  if (a.action === 'nextGiv') return;
  if (a.player === HUMAN || botPending) return;
  botPending = true;
  const wait = a.action === 'openOffer' ? 1600 : 650;
  setTimeout(() => {
    botPending = false;
    if (game.over || !game.awaiting || game.awaiting.player === HUMAN) return;
    const cur = game.awaiting;
    const i = cur.player;
    if (cur.action === 'exchange') game.exchange(i, botExchange(game.players[i].hand));
    else if (cur.action === 'openOffer') game.resolveOpen(i, botOpenChoice(game.players[i].hand, cur.card, game.openOffer.idx));
    else if (cur.action === 'bud') botBud(game.players[i].hand, cur.bestCat, cur.bestEv) != null ? game.announceBud(i) : game.budPass(i);
    else if (cur.action === 'fyrtalVal') game.fyrtalTake(i);
    else if (cur.action === 'chicago') botWantsChicago(game.players[i].hand, game.players[i].points) ? game.bidChicago(i) : game.passChicago();
    else if (cur.action === 'play') {
      const j = botPlay({
        hand: game.players[i].hand,
        trickCards: game.trickCards,
        mustSuit: cur.mustSuit,
        isBidder: game.bid === i,
        opponentBid: game.bid != null && game.bid !== i,
        trickNo: game.trickNo
      });
      game.playCard(i, j);
    }
  }, wait);
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
  return `${d.toLocaleDateString('sv-SE')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · giv ${g.giv} · ${g.players.map(x => x.points + 'p').join('-')}`;
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
function standingsHtml() {
  const rows = game.players.map(p => ({ name: p.name, pts: p.points })).sort((x, y) => y.pts - x.pts);
  let html = `<div class="standings"><div class="standcap">Giv ${game.giv} · ${game.players[game.dealer].name} ger · först till ${RULES.target} p</div>`;
  rows.forEach((r, k) => {
    const lead = k === 0 && rows.length > 1 && r.pts > rows[1].pts;
    html += `<div class="standrow${lead ? ' lead' : ''}"><span class="standrank">${k + 1}</span><span class="standname">${r.name}</span><span class="standpts">${r.pts} p</span></div>`;
  });
  return html + '</div>';
}
function showNewGame() {
  const n = chosenOpponents();
  const btns = [];
  for (let k = 1; k <= 3; k++) {
    btns.push(button(`Starta mot ${k} dator${k > 1 ? 'er' : ''}`, k === n ? 'primary' : '', () => {
      try { localStorage.setItem(OPP_KEY, String(k)); } catch (_) {}
      hideOverlay();
      startGame();
    }));
  }
  btns.push(button('Tillbaka till menyn', '', () => showMenu()));
  showOverlay(`<h2>Nytt parti</h2><p class="mini">Hur många datorer? Totalt 2-4 spelare. (Med fler än 4 kan talongen ta slut, skräphögen blandas då enligt reglerna.)</p>`, btns);
}

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
  btns.push(button('Nytt parti', hasSave ? '' : 'primary', () => showNewGame()));
  btns.push(button(`Logg${game && game.log.length ? ` (${game.log.length})` : ''}`, '', openLog));
  btns.push(button('Stäng', '', () => { hideOverlay(); render(); }));
  let head = `<h2>${title || 'Meny'}</h2>`;
  if (game && !game.over) head += standingsHtml();
  showOverlay(head, btns);
}

// --- Loggen som sidomeny ---
function openLog() {
  logOpen = true;
  lastSeenLog = game ? game.log.length : 0;
  if (el.logDrawer) el.logDrawer.classList.remove('hidden');
  if (el.logBackdrop) el.logBackdrop.classList.remove('hidden');
  render();
}
function closeLog() {
  logOpen = false;
  if (el.logDrawer) el.logDrawer.classList.add('hidden');
  if (el.logBackdrop) el.logBackdrop.classList.add('hidden');
  render();
}

// --- Vakt: om en händelse skulle gå förlorad körs datorns tur ändå ---
let botPending = false;
let logOpen = false;
let lastSeenLog = 0;
setInterval(() => { if (game && !game.over) maybeBot(); }, 1200);

function boot() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  el.menuBtn = document.getElementById('menuBtn');
  if (el.menuBtn) el.menuBtn.addEventListener('click', () => showMenu());
  if (el.logClose) el.logClose.addEventListener('click', closeLog);
  if (el.logBackdrop) el.logBackdrop.addEventListener('click', closeLog);
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
