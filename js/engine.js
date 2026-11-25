// Spelmotor för svenskt Chicago. Ramverksfri och serialiserbar så att samma
// moduler senare kan köras på en server för onlinespel.

import { newDeck, shuffle, evaluate5, compareHands, handPoints, handName, cardLabel } from './poker.js';

export const RULES = {
  target: 52,        // poäng som krävs för vinst
  kopstopp: 46,      // vid minst denna poäng efter avslutad giv får man inte längre byta kort
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
    this.discard = [];    // slängda kort (dolt öppet kort hamnar här)
    this.openOffer = null; // { player, idx, card } när ett öppet kort erbjuds
    this.budWhen = null; this.budNextPhase = null; this.budAnnounced = null; this.budCat = 0; this.budName = null;
    this.budAsked = new Set(); this.budOrder = [];
    this.budEv = null;
    this.fyrtalZeroUsed = false; this.fyrtalPending = null; this.fyrtalResume = null;
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
    this.say(`Giv ${this.giv} börjar. ${this.players[this.dealer].name} ger.`);
    this.step();
  }

  beginBud(when, nextPhase) {
    this.phase = 'bud';
    this.budWhen = when;
    this.budNextPhase = nextPhase;
    this.budAnnounced = null;
    this.budCat = 0;
    this.budName = null;
    this.budAsked = new Set();
    this.budOrder = [];
    for (let k = 0; k < this.players.length; k++) this.budOrder.push((this.dealer + 1 + k) % this.players.length);
    this.say(`Budgivning ${when}: ${this.players[this.budOrder[0]].name} säger först.`);
    return this._step();
  }

  // Får spelaren buda med den här handen? Tjuvpassning är förbjuden: slår
  // handen det aktuella budet, eller likar det med högre kort, måste det sägas.
  canBid(ev) {
    if (this.budCat === 0) return ev.cat > 0;
    if (ev.cat > this.budCat) return true;
    return ev.cat === this.budCat && !!this.budEv && compareHands(ev, this.budEv) > 0;
  }

  announceBud(i) {
    if (this.phase !== 'bud' || !this.awaiting || this.awaiting.action !== 'bud' || this.awaiting.player !== i) return;
    const ev = evaluate5(this.players[i].hand);
    if (this.canBid(ev)) {
      const sameCat = this.budCat === ev.cat && this.budAnnounced !== null;
      const prev = sameCat ? this.players[this.budAnnounced].name : null;
      this.budAnnounced = i;
      this.budCat = ev.cat;
      this.budName = handName(ev);
      this.budEv = { cat: ev.cat, tie: ev.tie.slice() };
      this.say(prev ? `${this.players[i].name} säger ${this.budName} (högre än ${prev}).` : `${this.players[i].name} säger ${this.budName}.`);
    } else {
      this.say(`${this.players[i].name} är tyst.`);
    }
    this.awaiting = null;
    if (this.budAsked.size < this.budOrder.length) return this.step();
    return this.resolveBud();
  }

  budPass(i) {
    if (this.phase !== 'bud' || !this.awaiting || this.awaiting.action !== 'bud' || this.awaiting.player !== i) return;
    const ev = evaluate5(this.players[i].hand);
    if (this.canBid(ev)) { // tjuvpassning: handen måste sägas
      this.say(`${this.players[i].name} får inte tjuvpassa, ${handName(ev)} måste sägas.`);
      return; // samma spelare väntar fortfarande
    }
    this.say(`${this.players[i].name} är tyst.`);
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
      this.say(`${this.players[wi].name} får ${pts} p för ${this.budName} ${this.budWhen}.`);
      this.emit({ type: 'score', when: this.budWhen, player: wi, pts, name: this.budName, viaBud: true });
    } else {
      this.say(`Ingen bjuder ${this.budWhen}, ingen handpoäng.`);
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
    this.say(`${this.players[f.player].name} tar ${f.pts} p för ${f.name}.`);
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
    this.say(`${this.players[i].name} nollställer alla poäng i stället för att ta ${f.pts} p för ${f.name}! Bara en gång per parti.`);
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

  exchange(i, idxs) {
    const p = this.players[i];
    if (idxs.length === 1 && this.talong.length) {
      // Ett öppet: kortet som skulle dras visas öppet för alla. Ta det eller
      // släng det och ta nästa kort stängt.
      const card = this.talong[this.talong.length - 1];
      this.openOffer = { player: i, idx: idxs[0], card };
      this.awaiting = { player: i, action: 'openOffer', card };
      this.say(`Öppet kort: ${cardLabel(card)} — ${p.name} väljer.`);
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
    this.say(`${p.name} byter ${removed.length} kort${mustShow ? ' (visar byteskorten)' : ''}.`);
    this.step();
  }

  refillTalong() {
    if (this.talong.length || !this.discard.length) return;
    this.talong = shuffle(this.discard, this.rng);
    this.discard = [];
    this.say(`Talongen tog slut. Skräphögen (${this.talong.length} kort) blandas till ny talong.`);
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
      this.say(`${p.name} tog det öppna kortet (${cardLabel(open)}).`);
    } else {
      const open = this.talong.pop();
      this.discard.push(open);
      this.refillTalong();
      if (this.talong.length) {
        p.hand.push(this.talong.pop());
        this.say(`${p.name} slängde det öppna kortet och tog ett stängt.`);
      } else {
        this.say(`${p.name} slängde det öppna kortet; talongen tog slut, inget nytt kort.`);
      }
    }
    this.exchanged.add(i);
    this.emit({ type: 'open', player: i, took: take });
    this.step();
  }

  bidChicago(i) {
    this.bid = i;
    this.say(`${this.players[i].name} budar CHICAGO! Alla fem stick måste tas.`);
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
    if (this.bid) this.say(`Sticken börjar. ${this.players[this.bid].name} måste ta alla fem.`);
    this.step();
  }

  playCard(i, cardIdx) {
    const p = this.players[i];
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
      const next = this.players.findIndex((p, i) => !this.chicagoAsked.has(i) && p.points >= RULES.chicagoMin);
      if (next === -1 || this.bid !== null) { this.beginTricks(); return; }
      this.chicagoAsked.add(next);
      this.awaiting = { player: next, action: 'chicago' };
      return;
    }
    if (this.phase === 'tricks') {
      if (this.trickCards.length === this.players.length) {
        const ledSuit = this.trickCards[0].card.s;
        let winIdx = this.trickCards[0].player, winR = -1;
        for (const tc of this.trickCards) if (tc.card.s === ledSuit && tc.card.r > winR) { winIdx = tc.player; winR = tc.card.r; }
        this.tricksWon[winIdx]++;
        const winCard = this.trickCards.find(t => t.player === winIdx).card;
        this.say(`${this.players[winIdx].name} tar stick ${this.trickNo + 1} med ${cardLabel(winCard)}.`);
        this.trickCards = [];
        this.trickNo++;
        if (this.bid && winIdx !== this.bid) { this.endGiv('broken'); return; }
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
      this.players[lastWinner].points += RULES.lastTrick;
      this.say(`${this.players[lastWinner].name} tar sista sticket: +${RULES.lastTrick} p.`);
      if (this.bid !== null && this.bid === lastWinner) {
        this.players[this.bid].points += RULES.chicagoGain;
        this.say(`${this.players[this.bid].name} lyckades med Chicago-budet: +${RULES.chicagoGain} p!`);
      }
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
          this.say(`Sluthand: ${this.players[holders[0]].name} får ${pts} p för ${handName(best)}.`);
        } else {
          this.say('Lika bästa sluthänder, ingen poäng.');
        }
      }
    } else {
      this.players[this.bid].points -= RULES.chicagoLoss;
      this.say(`Chicago-budet bröts. ${this.players[this.bid].name} får −${RULES.chicagoLoss} p och given avslutas direkt.`);
    }
    this.finishEndGiv();
  }

  finishEndGiv() {
    for (const p of this.players) {
      if (p.points >= RULES.kopstopp && !p.kopstopp) {
        p.kopstopp = true;
        this.say(`${p.name} har köpstopp vid ${p.points} p och byter inte fler kort.`);
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
        this.say(`${this.winner.name} vinner partiet med ${top} poäng!`);
        this.emit({ type: 'gameOver', winner: this.winner.name, points: top });
        this.awaiting = null;
        return;
      }
      this.say('Oavgjort i toppen, partiet fortsätter.');
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
      budEv: this.budEv, fyrtalZeroUsed: this.fyrtalZeroUsed, fyrtalPending: this.fyrtalPending, fyrtalResume: this.fyrtalResume,
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
    g.budEv = d.budEv || null; g.fyrtalZeroUsed = !!d.fyrtalZeroUsed; g.fyrtalPending = d.fyrtalPending || null; g.fyrtalResume = d.fyrtalResume || null;
    g.log = d.log || []; g.history = d.history || []; g.awaiting = d.awaiting || null;
    g.discard = d.discard || []; g.openOffer = d.openOffer || null;
    return g;
  }

}
