// Alla texter som visas i spelet samlas här, så att språk och ordalydelse kan
// anpassas på ett ställe. Motor och gränssnitt läser texterna från T.
// Namn på handkategorierna, används i både motor och gränssnitt.
export const CAT_NAMES = { 1: 'Par', 2: 'Två par', 3: 'Triss', 4: 'Stege', 5: 'Färg', 6: 'Kåk', 7: 'Fyrtal', 8: 'Färgstege' };

export const T = {
  giv: {
    start: (n, d) => `Giv ${n} börjar. ${d} ger.`,
    bytKort: (p, k, visa) => `${p} byter ${k} kort${visa ? ' (visar byteskorten)' : ''}.`,
    oppetKort: (kort, p) => `Öppet kort: ${kort} — ${p} väljer.`,
    togOppet: (p, kort) => `${p} tog det öppna kortet (${kort}).`,
    slangOppetStangt: p => `${p} slängde det öppna kortet och tog ett stängt.`,
    slangOppetTajt: p => `${p} slängde det öppna kortet; talongen tog slut, inget nytt kort.`,
    talongTogSlut: k => `Talongen tog slut. Skräphögen (${k} kort) blandas till ny talong.`
  },
  bud: {
    start: (n, p) => `Budgivning ${n}: ${p} säger först.`,
    annons: (p, h) => `${p} säger ${h}.`,
    tyst: p => `${p} är tyst.`,
    tjuvpassning: (p, h) => `${p} får inte tjuvpassa, ${h} måste sägas.`,
    poang: (p, n, h, w) => `${p} får ${n} p för ${h} ${w}.`,
    ingen: w => `Ingen bjuder ${w}, ingen handpoäng.`
  },
  halv: {
    delar: (a, b, h) => `${a} säger ${h} och delar med ${b}. Halvering: ${a} får fråga.`,
    fraga: (a, b, label, rank) => `${a} frågar ${b}: har ${label} över eller under ${rank}?`,
    svarText: { 'över': 'Över', 'under': 'Under', 'exakt': 'Exakt' },
    svar: (p, a) => `${p} svarar: ${a}.`,
    over: p => `${p} har över och behåller budet. Klart, inga fler frågor.`,
    under: p => `${p} är under: ${p} tar budet. Klart.`,
    vidare: label => `Samma valör: frågan går vidare till ${label}.`,
    lika: p => `Alla svar exakt: händerna är identiska och ${p} behåller budet.`
  },
  fyrtal: {
    tar: (p, n, h) => `${p} tar ${n} p för ${h}.`,
    nollstaller: (p, n, h) => `${p} nollställer alla poäng i stället för att ta ${n} p för ${h}! Bara en gång per parti.`
  },
  stick: {
    chicago: p => `${p} budar CHICAGO! Alla fem stick måste tas.`,
    borjar: p => `Sticken börjar. ${p} måste ta alla fem.`,
    foljFargen: p => `${p} måste följa färgen.`,
    vinner: (p, k, kort) => `${p} tar stick ${k} med ${kort}.`,
    chicagoLyckat: (p, n) => `${p} lyckades med Chicago-budet: +${n} p, given ger inga andra poäng.`,
    sistaSticket: (p, n) => `${p} tar sista sticket: +${n} p.`,
    sluthand: (p, n, h) => `Sluthand: ${p} får ${n} p för ${h}.`,
    likaSluthander: () => 'Lika bästa sluthänder, ingen poäng.',
    brotet: (p, n) => `Chicago-budet bröts. ${p} får −${n} p och given avslutas direkt.`
  },
  kop: {
    kopstopp: (p, n) => `${p} har köpstopp vid ${n} p och byter inte fler kort.`
  },
  slut: {
    vinner: (p, n) => `${p} vinner partiet med ${n} poäng!`,
    oavgjort: () => 'Oavgjort i toppen, partiet fortsätter.'
  },
  ui: {
    title: 'Chicago – kortspel online',
    h1: 'Chicago',
    logg: 'Logg',
    givLabel: (n, d) => `Giv ${n} · ${d} ger`,
    talong: (n, d) => `Talong ${n} · discard ${d}`,
    phaseKop: n => `Byta kort ${n}`,
    phaseBud: 'Budgivning',
    phaseStick: 'Stickspel',
    phaseChicago: 'Chicago-bud?',
    phaseGivEnd: 'Given avslutad',
    // Budgivning
    redanSagt: h => `Redan sagt: ${h}`,
    ingenSagt: () => 'Ingen har sagt något ännu. ',
    overtog: ', övertog budet',
    duMaste: 'Du måste säga.',
    duKanTyst: 'Du kan vara tyst.',
    duKanUtmana: 'Du kan utmana med samma kategori.',
    saga: h => `Säg ${h}`,
    tyst: 'Tyst',
    // Halvering
    halvDuDelar: (k, m, label) => `Halvering: du delar ${k} med ${m}. Frågan gäller: ${label}.`,
    halvDittVarde: rank => `Ditt värde: ${rank}.`,
    halvStallFragan: 'Ställ frågan',
    halvDuSvarar: (a, label, rank) => `Halvering: ${a} frågar: har ${label} över eller under ${rank}? Svara sanningsenligt.`,
    over: 'Över',
    under: 'Under',
    exakt: 'Exakt',
    // Byta kort
    kop: n => `Köp ${n}`,
    bytValda: n => `Byt ${n} valda kort`,
    bytStangt: 'Byt stängt (utan öppet kort)',
    rensa: 'Rensa val',
    taOppet: 'Ta det öppna kortet',
    slangDra: 'Släng det och dra ett stängt',
    taEllerSlang: 'Ta det öppna kortet, eller släng det och dra ett stängt.',
    valjKort: 'Välj kort att byta (eller byt inga).',
    // Chicago
    budaChicago: 'Buda Chicago',
    tackaNej: 'Tacka nej',
    chicagoInfo: 'Du kan buda Chicago: lova att ta alla fem stick.',
    chicagoDuBudar: 'Du har budat Chicago – du tar alla fem stick.',
    // Stick
    spelUtVad: 'Spel ut vilket kort som helst.',
    foljFarg: s => `Följ ${s} om du kan.`,
    forraSticket: 'Förra sticket',
    // Övrigt
    tunker: p => `${p} tänker...`,
    datornValjer: ' — datorn väljer...',
    forstTill: n => `Först till ${n} poäng när given är klar vinner partiet.`,
    forstTillKlar: n => `Först till ${n} poäng när given är färdig.`,
    duVann: 'Du vann!',
    vann: p => `${p} vann`,
    nyttParti: 'Nytt parti',
    nastaGiv: 'Nästa giv',
    poangtabell: 'Poängtabell',
    givRad: 'Giv',
    totalt: 'Totalt',
    fyrtalMsg: 'Fyrtal! Ta poängen, eller nollställ alla poäng (bara en gång per parti).',
    fyrtalTa: 'Fyrtal eller nollställ',
    nollstall: 'Nollställ alla poäng',
    arkiv: 'Arkiv',
    arkivAntal: n => `Arkiv (${n})`,
    ingaSparade: 'Inga sparade partier.',
    oppna: (i, n) => `Öppna ${i}: ${n}`,
    taBort: i => `Ta bort ${i}`,
    tillbaka: 'Tillbaka till menyn',
    sparaParti: 'Spara parti i arkivet',
    sparat: 'Sparat i arkivet',
    fortsattSparat: 'Fortsätt sparade partiet',
    stang: 'Stäng',
    nyttPartiRubrik: 'Nytt parti',
    antalDatorer: 'Hur många datorer? Totalt 2-4 spelare. (Med fler än 4 kan talongen ta slut, skräphögen blandas då enligt reglerna.)',
    startaMot: k => `Starta mot ${k} dator${k > 1 ? 'er' : ''}`,
    standcap: (g, d, n) => `Giv ${g} · ${d} ger · först till ${n} p`
  }
};
