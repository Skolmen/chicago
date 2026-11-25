// Spelmotor för svenskt Chicago. Ramverksfri och serialiserbar så att samma
// moduler senare kan köras på en server för onlinespel.

import { newDeck, shuffle, evaluate5, compareHands, handPoints, handName, cardLabel, rankLabel } from './poker.js?v=25';
import { T } from './texts.js?v=25';

// Halvering (poängdiskussion): vad frågan gäller per kategori.
const HALV_LABEL = { 1: 'ditt par', 2: 'ditt bästa par', 3: 'din triss', 4: 'högsta kortet i din stege', 5: 'högsta kortet i din färg', 6: 'trissen i din kåk', 7: 'ditt fyrtal', 8: 'högsta kortet i din färgstege' };
// Vid exakt samma valör går frågan vidare till nästa avgörande kort (issue 78).
function halvCompLabel(cat, comp) {
  if (comp === 0) return HALV_LABEL[cat];
  return comp === 1 ? 'högsta kortet efteråt' : `kort nummer ${comp + 1}`;
}

export const RULES = {
  target: 52,        // poäng som krävs för vinst
  kopstopp: 45,      // har man denna poäng efter avslutad giv har man köpstopp och byter inte kort
  chicagoMin: 15,    // minst så många poäng krävs för att få buda Chicago
  chicagoGain: 15,   // poäng för lyckat Chicago-bud
  chicagoLoss: 15,   // minuspoäng för brutet Chicago-bud
  lastTrick: 5       // poäng för sista sticket
};

export class Game {
  constructor(names, rng = Math.random) {
    this.rng = rng;
    this.players = names.map(n => ({ name: n, points: 0, hand: [], kopstopp: false, lastScoredCat: 0 }));
    this.history = [];
    this.giv = 0;
    this.dealer = names.length - 1;
    this.over = false;
    this.winner = null;
    this.log = [];
    this.awaiting = null; // { player, action, ... } som väntar på input
    this.trickCards = []; // initierad direkt så att toJSON runtresan blir stabil
    this.discard = [];    // slängda kort (dolt öppet kort hamnar här)
    this.openOffer = null; // { player, idx, card } när ett öppet kort erbjuds
    this.budWhen = null; this.budNextPhase = null; this.budAnnounced = null; this.budCat = 0; this.budName = null;
    this.budAsked = new Set(); this.budOrder = [];
    this.budEv = null;
    this.fyrtalZeroUsed = false; this.fyrtalPending = null; this.fyrtalResume = null;
    this.bid = null; this.chicagoAsked = new Set();
    this.onEvent = null;
  }

  emit(e) { if (this.onEvent) this.onEvent(e); }
  say(msg) { this.log.push(msg); this.emit({ type: 'log', msg }); }

  start() { this.nextGiv(); }

  hasSuit(i, s) { return this.players[i].hand.some(c => c.s === s); }

  nextGiv() {
    if (this.over) return;
    this.giv++;
    this.dealer = (this.dealer + 1) % this.players.length;
    const deck = shuffle(newDeck(), this.rng);
    for (const p of this.players) p.hand = deck.splice(0, 5);
    this.talong = deck;
    this.phase = 'kop1';
    this.exchanged = new Set();
    this.budWhen = null; this.budNextPhase = null; this.budAnnounced = null; this.budCat = 0; this.budName = null;
    this.budAsked = new Set(); this.budOrder = [];
    this.budEv = null;
    this.fyrtalPending = null; this.fyrtalResume = null;
    this.bid = null;
    this.chicagoAsked = new Set();
    this.trickNo = 0;
    this.trickCards = [];
    this.tricksWon = this.players.map(() => 0);
    this.leader = null;
    this.sluthand = null;
    this.discard = [];
    this.openOffer = null;
    this.awaiting = null;
    this.say(T.giv.start(this.giv, this.players[this.dealer].name));
    this.step();
  }

  beginBud(when, nextPhase) {
    this.phase = 'bud';
    this.budWhen = when;
    this.budNextPhase = nextPhase;
    this.budAnnounced = null;
    this.budCat = 0;
    this.budName = null;
    this.budNote = null;
    this.halv = null;
    this.budAsked = new Set();
    this.budOrder = [];
    for (let k = 0; k < this.players.length; k++) this.budOrder.push((this.dealer + 1 + k) % this.players.length);
    this.say(T.bud.start(when, this.players[this.budOrder[0]].name));
    return this._step();
  }

  // Får spelaren annonsera den här handen? Samma kategori får utmanas i båda
  // riktningar: ingen av spelarna kan se den andras hand, halveringen avgör
  // vem som har den högre. Tjuvpassning (passa och sedan annonsera) är förbjuden.
  canBid(ev) {
    if (this.budCat === 0) return ev.cat > 0;
    if (ev.cat > this.budCat) return true;
    return ev.cat === this.budCat && this.budAnnounced !== null;
  }

  // Måste handen sägas? Endast en hand som säkert slår budet är tvingad; ett
  // utmaningsbud i samma kategori är frivilligt eftersom utgången är okänd.
  mustSay(ev) {
    if (this.budCat === 0) return ev.cat > 0;
    if (ev.cat > this.budCat) return true;
    return ev.cat === this.budCat && !!this.budEv && compareHands(ev, this.budEv) > 0;
  }

  announceBud(i) {
    if (this.phase !== 'bud' || !this.awaiting || this.awaiting.action !== 'bud' || this.awaiting.player !== i) return;
    const ev = evaluate5(this.players[i].hand);
    if (this.canBid(ev)) {
      const sameCat = this.budCat === ev.cat && this.budAnnounced !== null;
      if (sameCat) {
        // Poängdiskussion (issue 75): den som delar ställer halveringsfrågor
        // till budhållaren innan händerna jämförs.
        const prevIdx = this.budAnnounced;
        this.halv = { asker: i, target: prevIdx, cat: ev.cat, n: 0, comp: 0, name: handName(ev), ev: { cat: ev.cat, tie: ev.tie.slice() } };
        this.say(T.halv.delar(this.players[i].name, this.players[prevIdx].name, handName(ev)));
        this.awaiting = { player: i, action: 'halvAsk', target: prevIdx, cat: ev.cat, label: halvCompLabel(ev.cat, 0) };
        this.emit({ type: 'await', awaiting: this.awaiting });
        return;
      }
      this.budAnnounced = i;
      this.budCat = ev.cat;
      this.budName = handName(ev);
      this.budEv = { cat: ev.cat, tie: ev.tie.slice() };
      this.budNote = null;
      this.say(T.bud.annons(this.players[i].name, this.budName));
    } else {
      this.say(T.bud.tyst(this.players[i].name));
    }
    this.awaiting = null;
    if (this.budAsked.size < this.budOrder.length) return this.step();
    return this.resolveBud();
  }

  // Halvering (issue 86): frågeställaren ställer EN fråga per avgörande
  // komponent, vid sitt EGET värde. Över = budhållaren behåller, under =
  // frågeställaren tar budet, exakt = nästa avgörande komponent. Svaret avgör
  // alltid direkt, ingen blind slutjämförelse behövs.
  halvAsk(i, n) {
    if (this.phase !== 'bud' || !this.halv || !this.awaiting || this.awaiting.action !== 'halvAsk' || this.awaiting.player !== i) return;
    const label = halvCompLabel(this.halv.cat, this.halv.comp);
    const value = (n === undefined || n === null) ? evaluate5(this.players[i].hand).tie[this.halv.comp] : n;
    this.halv.n++;
    this.say(T.halv.fraga(this.players[i].name, this.players[this.halv.target].name, label, rankLabel(value)));
    this.awaiting = { player: this.halv.target, action: 'halvAnswer', n: value, label, asker: this.halv.asker };
  }

  halvAnswer(i, ans) {
    if (this.phase !== 'bud' || !this.halv || !this.awaiting || this.awaiting.action !== 'halvAnswer' || this.awaiting.player !== i) return;
    const h = this.halv;
    this.say(T.halv.svar(this.players[i].name, T.halv.svarText[ans] || ans)); // svaret syns alltid i loggen (issue 87)
    if (ans === 'över') {
      this.halv = null; this.awaiting = null;
      this.say(T.halv.over(this.players[h.target].name));
      return this.budAsked.size < this.budOrder.length ? this.step() : this.resolveBud();
    }
    if (ans === 'under') {
      this.budAnnounced = h.asker; this.budCat = h.cat; this.budName = h.name; this.budEv = h.ev; this.budNote = 'övertog budet';
      this.halv = null; this.awaiting = null;
      this.say(T.halv.under(this.players[h.asker].name));
      return this.budAsked.size < this.budOrder.length ? this.step() : this.resolveBud();
    }
    if (this.halv.comp < h.ev.tie.length - 1) {
      this.halv.comp++;
      this.say(T.halv.vidare(halvCompLabel(h.cat, this.halv.comp)));
      this.awaiting = { player: h.asker, action: 'halvAsk', target: h.target, cat: h.cat, label: halvCompLabel(h.cat, this.halv.comp) };
      return;
    }
    this.halv = null; this.awaiting = null;
    this.say(T.halv.lika(this.players[h.target].name));
    return this.budAsked.size < this.budOrder.length ? this.step() : this.resolveBud();
  }

  budPass(i) {
    if (this.phase !== 'bud' || !this.awaiting || this.awaiting.action !== 'bud' || this.awaiting.player !== i) return;
    const ev = evaluate5(this.players[i].hand);
    if (this.mustSay(ev)) { // tjuvpassning: en hand som säkert slår budet måste sägas
      this.say(T.bud.tjuvpassning(this.players[i].name, handName(ev)));
      return; // samma spelare väntar fortfarande
    }
    this.say(T.bud.tyst(this.players[i].name));
    this.awaiting = null;
    if (this.budAsked.size < this.budOrder.length) return this.step();
    return this.resolveBud();
  }

  resolveBud() {
    if (this.budAnnounced !== null) {
      const wi = this.budAnnounced;
      const pts = handPoints(evaluate5(this.players[wi].hand));
      if (this.budCat === 7 && !this.fyrtalZeroUsed) {
        // Fyrtal: 8 p eller nollställ alla (bara en gång per parti)
        this.fyrtalPending = { player: wi, pts, name: this.budName, source: 'bud' };
        this.fyrtalResume = { source: 'bud', phase: this.budNextPhase };
        this.phase = 'fyrtalVal';
        this.awaiting = { player: wi, action: 'fyrtalVal' };
        this.emit({ type: 'await', awaiting: this.awaiting });
        return;
      }
      this.players[wi].points += pts;
      this.players[wi].lastScoredCat = this.budCat;
      this.say(T.bud.poang(this.players[wi].name, pts, this.budName, this.budWhen));
      this.emit({ type: 'score', when: this.budWhen, player: wi, pts, name: this.budName, viaBud: true });
    } else {
      this.say(T.bud.ingen(this.budWhen));
      this.emit({ type: 'score', when: this.budWhen, scored: null });
    }
    this.phase = this.budNextPhase;
    this.awaiting = null;
    return this.step(); // via step() så att "väntar på X"-händelsen når gränssnittet
  }

  fyrtalTake(i) {
    if (this.phase !== 'fyrtalVal' || !this.awaiting || this.awaiting.action !== 'fyrtalVal' || this.awaiting.player !== i || !this.fyrtalPending) return;
    const f = this.fyrtalPending;
    this.players[f.player].points += f.pts;
    this.players[f.player].lastScoredCat = 7;
    this.say(T.fyrtal.tar(this.players[f.player].name, f.pts, f.name));
    this.emit({ type: 'score', player: f.player, pts: f.pts, name: f.name });
    this.fyrtalPending = null;
    this.awaiting = null;
    return this.afterFyrtal();
  }

  // Fyrtal kan i stället för poängen nollställa alla poäng, en gång per parti.
  fyrtalZero(i) {
    if (this.phase !== 'fyrtalVal' || !this.awaiting || this.awaiting.action !== 'fyrtalVal' || this.awaiting.player !== i || !this.fyrtalPending || this.fyrtalZeroUsed) return;
    const f = this.fyrtalPending;
    this.fyrtalZeroUsed = true;
    for (const pl of this.players) { pl.points = 0; pl.kopstopp = false; }
    this.say(T.fyrtal.nollstaller(this.players[i].name, f.pts, f.name));
    this.emit({ type: 'score', player: i, pts: 0, name: 'Nollställning' });
    this.fyrtalPending = null;
    this.awaiting = null;
    return this.afterFyrtal();
  }

  afterFyrtal() {
    const r = this.fyrtalResume;
    this.fyrtalResume = null;
    if (!r) return;
    if (r.source === 'bud') { this.phase = r.phase; return this.step(); }
    return this.finishEndGiv();
  }

  exchange(i, idxs, closedDirect = false) {
    const p = this.players[i];
    if (idxs.length === 1 && this.talong.length && !closedDirect) {
      // Ett öppet: kortet som skulle dras visas öppet för alla. Ta det eller
      // släng det och ta nästa kort stängt.
      const card = this.talong[this.talong.length - 1];
      this.openOffer = { player: i, idx: idxs[0], card };
      this.awaiting = { player: i, action: 'openOffer', card };
      this.say(T.giv.oppetKort(cardLabel(card), p.name));
      this.emit({ type: 'await', awaiting: this.awaiting });
      return;
    }
    const discard = new Set(idxs);
    const removed = p.hand.filter((c, k) => discard.has(k));
    p.hand = p.hand.filter((c, k) => !discard.has(k));
    this.discard.push(...removed);
    for (let d = 0; d < removed.length; d++) {
      this.refillTalong();
      if (!this.talong.length) break;
      p.hand.push(this.talong.pop());
    }
    this.exchanged.add(i);
    const mustShow = removed.length > 0 && p.lastScoredCat >= 1;
    this.awaiting = null;
    this.emit({ type: 'exchange', player: i, count: removed.length, mustShow });
    this.say(T.giv.bytKort(p.name, removed.length, mustShow));
    this.step();
  }

  refillTalong() {
    if (this.talong.length || !this.discard.length) return;
    this.talong = shuffle(this.discard, this.rng);
    this.discard = [];
    this.say(T.giv.talongTogSlut(this.talong.length));
    this.emit({ type: 'reshuffle' });
  }

  resolveOpen(i, take) {
    const a = this.awaiting;
    if (!a || a.action !== 'openOffer' || a.player !== i || !this.openOffer) return;
    const p = this.players[i];
    const { idx } = this.openOffer;
    this.awaiting = null;
    this.openOffer = null;
    const dropped = p.hand.splice(idx, 1)[0];
    this.discard.push(dropped);
    if (take) {
      const open = this.talong.pop();
      p.hand.push(open);
      this.say(T.giv.togOppet(p.name, cardLabel(open)));
    } else {
      const open = this.talong.pop();
      this.discard.push(open);
      this.refillTalong();
      if (this.talong.length) {
        p.hand.push(this.talong.pop());
        this.say(T.giv.slangOppetStangt(p.name));
      } else {
        this.say(T.giv.slangOppetTajt(p.name));
      }
    }
    this.exchanged.add(i);
    this.emit({ type: 'open', player: i, took: take });
    this.step();
  }

  bidChicago(i) {
    this.bid = i;
    this.say(T.stick.chicago(this.players[i].name));
    this.emit({ type: 'bid', player: i });
    this.awaiting = null;
    this.step();
  }

  passChicago() {
    this.awaiting = null;
    this.step();
  }

  beginTricks() {
    this.phase = 'tricks';
    this.trickNo = 0;
    this.trickCards = [];
    this.leader = (this.dealer + 1) % this.players.length;
    if (this.bid != null) this.say(T.stick.borjar(this.players[this.bid].name));
    this.step();
  }

  playCard(i, cardIdx) {
    if (this.phase !== 'tricks' || !this.awaiting || this.awaiting.action !== 'play' || this.awaiting.player !== i) return;
    const p = this.players[i];
    if (!Number.isInteger(cardIdx) || cardIdx < 0 || cardIdx >= p.hand.length) return;
    const mustSuit = this.awaiting.mustSuit;
    if (mustSuit != null && p.hand.some(c => c.s === mustSuit) && p.hand[cardIdx].s !== mustSuit) {
      this.say(T.stick.foljFargen(p.name));
      return;
    }
    const card = p.hand.splice(cardIdx, 1)[0];
    this.trickCards.push({ player: i, card });
    this.emit({ type: 'play', player: i, card });
    this.awaiting = null;
    this.step();
  }

  step() {
    this._step();
    if (this.awaiting) this.emit({ type: 'await', awaiting: this.awaiting });
  }

  _step() {
    if (this.over) return;
    if (this.phase === 'kop1' || this.phase === 'kop2' || this.phase === 'kop3') {
      const next = this.players.findIndex((p, i) => !this.exchanged.has(i) && !p.kopstopp);
      if (next === -1) {
        if (this.phase === 'kop1') { this.exchanged = new Set(); return this.beginBud('efter första bytet', 'kop2'); }
        if (this.phase === 'kop2') { this.exchanged = new Set(); return this.beginBud('efter andra bytet', 'kop3'); }
        this.sluthand = this.players.map(p => p.hand.slice());
        this.phase = 'chicago';
        this.chicagoAsked = new Set();
        return this._step();
      }
      this.awaiting = { player: next, action: 'exchange' };
      return;
    }
    if (this.phase === 'bud') {
      const next = this.budOrder.find(i => !this.budAsked.has(i));
      if (next === undefined) return this.resolveBud();
      this.budAsked.add(next);
      this.awaiting = { player: next, action: 'bud', bestCat: this.budCat, bestName: this.budName, bestEv: this.budEv };
      return;
    }
    if (this.phase === 'chicago') {
      if (this.bid != null) { this.beginTricks(); return; }
      const n = this.players.length;
      for (let k = 1; k <= n; k++) {
        const i = (this.dealer + k) % n;
        if (this.chicagoAsked.has(i)) continue;
        this.chicagoAsked.add(i);
        if (this.players[i].points >= RULES.chicagoMin) {
          this.awaiting = { player: i, action: 'chicago' };
          return;
        }
      }
      this.beginTricks();
      return;
    }
    if (this.phase === 'tricks') {
      if (this.trickCards.length === this.players.length) {
        const ledSuit = this.trickCards[0].card.s;
        let winIdx = this.trickCards[0].player, winR = -1;
        for (const tc of this.trickCards) if (tc.card.s === ledSuit && tc.card.r > winR) { winIdx = tc.player; winR = tc.card.r; }
        this.tricksWon[winIdx]++;
        const winCard = this.trickCards.find(t => t.player === winIdx).card;
        this.say(T.stick.vinner(this.players[winIdx].name, this.trickNo + 1, cardLabel(winCard)));
        this.discard.push(...this.trickCards.map(t => t.card));
        this.trickCards = [];
        this.trickNo++;
        if (this.bid != null && winIdx !== this.bid) { this.endGiv('broken'); return; }
        this.leader = winIdx;
        if (this.trickNo === 5) { this.endGiv('normal', winIdx); return; }
      }
      const idx = this.trickCards.length === 0 ? this.leader : (this.leader + this.trickCards.length) % this.players.length;
      const mustSuit = this.trickCards.length ? this.trickCards[0].card.s : null;
      this.awaiting = { player: idx, action: 'play', mustSuit };
      return;
    }
  }

  endGiv(kind, lastWinner = null) {
    if (kind === 'normal') {
      if (this.bid !== null && this.bid === lastWinner) {
        // Lyckat Chicago: endast Chicago-poängen, ingen annan poäng denna giv
        this.players[this.bid].points += RULES.chicagoGain;
        this.say(T.stick.chicagoLyckat(this.players[this.bid].name, RULES.chicagoGain));
      } else {
      this.players[lastWinner].points += RULES.lastTrick;
      this.say(T.stick.sistaSticket(this.players[lastWinner].name, RULES.lastTrick));
      const evs = this.sluthand.map(h => evaluate5(h));
      let best = evs[0];
      for (const e of evs) if (compareHands(e, best) > 0) best = e;
      if (best.cat > 0) {
        const holders = evs.map((e, i) => compareHands(e, best) === 0 ? i : -1).filter(i => i >= 0);
        if (holders.length === 1) {
          if (best.cat === 7 && !this.fyrtalZeroUsed) {
            // Fyrtal i sluthanden: 8 p eller nollställ alla (bara en gång per parti)
            this.fyrtalPending = { player: holders[0], pts: handPoints(best), name: handName(best), source: 'sluthand' };
            this.fyrtalResume = { source: 'sluthand' };
            this.phase = 'fyrtalVal';
            this.awaiting = { player: holders[0], action: 'fyrtalVal' };
            this.emit({ type: 'await', awaiting: this.awaiting });
            return;
          }
          const pts = handPoints(best);
          this.players[holders[0]].points += pts;
          this.say(T.stick.sluthand(this.players[holders[0]].name, pts, handName(best)));
        } else {
          this.say(T.stick.likaSluthander());
        }
      }
      }
    } else {
      this.players[this.bid].points -= RULES.chicagoLoss;
      this.say(T.stick.brotet(this.players[this.bid].name, RULES.chicagoLoss));
    }
    this.finishEndGiv();
  }

  finishEndGiv() {
    for (const p of this.players) {
      if (p.points >= RULES.kopstopp && !p.kopstopp) {
        p.kopstopp = true;
        this.say(T.kop.kopstopp(p.name, p.points));
      }
    }
    this.history.push({ giv: this.giv, scores: this.players.map(p => p.points) });
    this.emit({ type: 'givEnd', scores: this.players.map(p => ({ name: p.name, points: p.points })) });
    const over = this.players.filter(p => p.points >= RULES.target);
    if (over.length) {
      const top = Math.max(...this.players.map(p => p.points));
      const winners = this.players.filter(p => p.points === top);
      if (winners.length === 1) {
        this.over = true;
        this.winner = winners[0];
        this.say(T.slut.vinner(this.winner.name, top));
        this.emit({ type: 'gameOver', winner: this.winner.name, points: top });
        this.awaiting = null;
        return;
      }
      this.say(T.slut.oavgjort());
    }
    this.phase = 'givEnd';
    this.awaiting = { action: 'nextGiv' };
    this.emit({ type: 'await', awaiting: this.awaiting });
  }
  // Spara och ladda parti (för localStorage).
  toJSON() {
    return {
      v: 1,
      players: this.players.map(p => ({ name: p.name, points: p.points, hand: p.hand, kopstopp: p.kopstopp, lastScoredCat: p.lastScoredCat })),
      giv: this.giv, dealer: this.dealer, talong: this.talong, phase: this.phase,
      exchanged: [...this.exchanged], bid: this.bid, chicagoAsked: [...this.chicagoAsked],
      trickNo: this.trickNo, trickCards: this.trickCards, tricksWon: this.tricksWon,
      leader: this.leader, sluthand: this.sluthand, over: this.over,
      discard: this.discard, openOffer: this.openOffer,
      budWhen: this.budWhen, budNextPhase: this.budNextPhase, budAnnounced: this.budAnnounced,
      budCat: this.budCat, budName: this.budName, budAsked: [...this.budAsked], budOrder: this.budOrder,
      budEv: this.budEv, budNote: this.budNote, fyrtalZeroUsed: this.fyrtalZeroUsed, fyrtalPending: this.fyrtalPending, fyrtalResume: this.fyrtalResume, halv: this.halv,
      winner: this.winner ? this.players.indexOf(this.winner) : null,
      log: this.log.slice(-120), history: this.history, awaiting: this.awaiting
    };
  }
  static fromJSON(d) {
    if (!d || d.v !== 1) return null;
    const g = new Game(d.players.map(p => p.name));
    g.players.forEach((p, i) => Object.assign(p, d.players[i]));
    g.giv = d.giv; g.dealer = d.dealer; g.talong = d.talong; g.phase = d.phase;
    g.exchanged = new Set(d.exchanged); g.bid = d.bid; g.chicagoAsked = new Set(d.chicagoAsked);
    g.trickNo = d.trickNo; g.trickCards = d.trickCards || []; g.tricksWon = d.tricksWon;
    g.leader = d.leader; g.sluthand = d.sluthand; g.over = d.over;
    g.winner = d.winner === null ? null : g.players[d.winner];
    g.budWhen = d.budWhen || null; g.budNextPhase = d.budNextPhase || null; g.budAnnounced = (d.budAnnounced === null || d.budAnnounced === undefined) ? null : d.budAnnounced;
    g.budCat = d.budCat || 0; g.budName = d.budName || null; g.budAsked = new Set(d.budAsked || []); g.budOrder = d.budOrder || [];
    g.budEv = d.budEv || null; g.budNote = d.budNote || null; g.fyrtalZeroUsed = !!d.fyrtalZeroUsed; g.fyrtalPending = d.fyrtalPending || null; g.fyrtalResume = d.fyrtalResume || null; g.halv = d.halv || null;
    g.log = d.log || []; g.history = d.history || []; g.awaiting = d.awaiting || null;
    g.discard = d.discard || []; g.openOffer = d.openOffer || null;
    return g;
  }

}
