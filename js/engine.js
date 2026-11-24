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
    this.giv = 0;
    this.dealer = names.length - 1;
    this.over = false;
    this.winner = null;
    this.log = [];
    this.awaiting = null; // { player, action, ... } som väntar på input
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
    this.bid = null;
    this.chicagoAsked = new Set();
    this.trickNo = 0;
    this.trickCards = [];
    this.tricksWon = this.players.map(() => 0);
    this.leader = null;
    this.sluthand = null;
    this.awaiting = null;
    this.say(`Giv ${this.giv} börjar. ${this.players[this.dealer].name} ger.`);
    this.step();
  }

  scoreHands(when) {
    const evs = this.players.map(p => evaluate5(p.hand));
    let best = evs[0];
    for (const e of evs) if (compareHands(e, best) > 0) best = e;
    if (best.cat === 0) {
      this.say(`Ingen har par eller bättre ${when}, ingen handpoäng.`);
      this.emit({ type: 'score', when, scored: null });
      return;
    }
    const holders = evs.map((e, i) => compareHands(e, best) === 0 ? i : -1).filter(i => i >= 0);
    if (holders.length !== 1) {
      this.say(`Lika bästa händer ${when}, ingen poäng.`);
      this.emit({ type: 'score', when, scored: null, tie: true });
      return;
    }
    const pts = handPoints(best), wi = holders[0];
    this.players[wi].points += pts;
    this.players[wi].lastScoredCat = best.cat;
    this.say(`${this.players[wi].name} får ${pts} p för ${handName(best)} ${when}.`);
    this.emit({ type: 'score', when, player: wi, pts, name: handName(best) });
  }

  exchange(i, idxs) {
    const p = this.players[i];
    const discard = new Set(idxs);
    const removed = p.hand.filter((c, k) => discard.has(k));
    p.hand = p.hand.filter((c, k) => !discard.has(k));
    const draw = Math.min(removed.length, this.talong.length);
    for (let d = 0; d < draw; d++) p.hand.push(this.talong.pop());
    this.exchanged.add(i);
    const mustShow = removed.length > 0 && p.lastScoredCat >= 1;
    this.awaiting = null;
    this.emit({ type: 'exchange', player: i, count: removed.length, mustShow });
    this.say(`${p.name} byter ${removed.length} kort${mustShow ? ' (visar byteskorten)' : ''}.`);
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
        if (this.phase === 'kop1') { this.scoreHands('efter första köpet'); this.phase = 'kop2'; this.exchanged = new Set(); return this._step(); }
        if (this.phase === 'kop2') { this.scoreHands('efter andra köpet'); this.phase = 'kop3'; this.exchanged = new Set(); return this._step(); }
        this.sluthand = this.players.map(p => p.hand.slice());
        this.phase = 'chicago';
        this.chicagoAsked = new Set();
        return this._step();
      }
      this.awaiting = { player: next, action: 'exchange' };
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
      const evs = this.sluthand.map(h => evaluate5(h));
      let best = evs[0];
      for (const e of evs) if (compareHands(e, best) > 0) best = e;
      if (best.cat > 0) {
        const holders = evs.map((e, i) => compareHands(e, best) === 0 ? i : -1).filter(i => i >= 0);
        if (holders.length === 1) {
          const pts = handPoints(best);
          this.players[holders[0]].points += pts;
          this.say(`Sluthand: ${this.players[holders[0]].name} får ${pts} p för ${handName(best)}.`);
        } else {
          this.say('Lika bästa sluthänder, ingen poäng.');
        }
      }
      if (this.bid !== null && this.bid === lastWinner) {
        this.players[this.bid].points += RULES.chicagoGain;
        this.say(`${this.players[this.bid].name} lyckades med Chicago-budet: +${RULES.chicagoGain} p!`);
      }
    } else {
      this.players[this.bid].points -= RULES.chicagoLoss;
      this.say(`Chicago-budet bröts. ${this.players[this.bid].name} får −${RULES.chicagoLoss} p och given avslutas direkt.`);
    }
    for (const p of this.players) {
      if (p.points >= RULES.kopstopp && !p.kopstopp) {
        p.kopstopp = true;
        this.say(`${p.name} har köpstopp vid ${p.points} p och byter inte fler kort.`);
      }
    }
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
}
