// Headless-test av hela UI-flödet (app.js) med minimal DOM-stub.
// Botens timer kortas till 1 ms så testet går snabbt men fortfarande asynkront.
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms) => realSetTimeout(fn, 1);

const elements = new Map();
function makeEl(id) {
  return {
    id, textContent: '', innerHTML: '', children: [],
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(type, fn) { this['on_' + type] = fn; },
    appendChild(c) { this.children.push(c); },
  };
}
globalThis.document = {
  getElementById(id) { if (!elements.has(id)) elements.set(id, makeEl(id)); return elements.get(id); },
  createElement() { return makeEl('tmp'); },
};
globalThis.window = globalThis;

const errors = [];
process.on('uncaughtException', e => { errors.push(String(e && e.message || e)); });

await import('./js/app.js');

const sleep = ms => new Promise(r => realSetTimeout(r, ms));
let guard = 0, stuck = 0, finished = false;
const dbg = [];
while (guard++ < 8000 && stuck < 6) {
  await sleep(3);
  if (guard % 400 === 0) dbg.push('varv ' + guard + ' giv=' + elements.get('givLabel').textContent + ' poang=' + elements.get('scoreYou').textContent + '/' + elements.get('scoreBot').textContent + ' overlay=' + elements.get('overlayContent').innerHTML.slice(0,30) + ' medd=' + elements.get('tableMsg').textContent.slice(0,40) + ' knappar=' + elements.get('actions').children.length + ' kort=' + elements.get('playerCards').children.length);
  const overlay = elements.get('overlayContent');
  if (overlay.innerHTML.includes('Först till')) { finished = true; break; }
  const acts = elements.get('actions');
  const btn = acts.children.find(c => c['on_click']);
  if (btn) { btn['on_click'](); stuck = 0; continue; }
  const cards = elements.get('playerCards');
  const card = cards.children.find(c => c['on_click']);
  if (card) { card['on_click'](); stuck = 0; continue; }
  stuck++;
}
