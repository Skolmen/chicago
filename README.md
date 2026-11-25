# Chicago online

Kortspelet Chicago (svenska regler) i webbläsaren, mobilanpassat. Spela mot datorn.

## Regler (källa: qort.se/chicago, PDF-reglerna)

- 2–4 spelare, 52 kort utan jokrar, 5 kort var, resten är talong.
- Varje giv: tre köprundor (byt valfritt antal kort, dra lika många), sedan fem stick utan trumf. Följ utspelsfärgen om du kan, högsta kortet i utspelsfärgen vinner.
- Poäng för bästa pokerhand efter köp 1, köp 2 och efter sticken (sluthand). Par 1, två par 2, triss 3, stege 4, färg 5, kåk 6, fyrtal 8, färgstege 52 (royal räknas som färgstege). Exakt lika bästa händer ger ingen poäng, och inga poäng utan par eller bättre. Fyrtal kan i stället för 8 p nollställa alla poäng, men det får bara göras en gång per parti.
- Budgivning efter första och andra bytet: den som sitter efter givaren säger först, sedan går det runt. Säg din handkategori eller var tyst, men tjuvpassning är förbjudet: en hand som slår budet, eller likar det med högre kort, måste sägas. Samma kategori öppnar halvering: den som delar får ställa över/under-frågor till budhållaren (t.ex. "har ditt par över eller under sju?"); svaren ska vara sanningsenliga och syns i loggen, därefter jämförs händerna och högst hand tar budet.
- Sista sticket ger 5 poäng. Först till 52 poäng när given är färdig vinner; flera över 52: högsta total vinner.
- Köpstopp: har man 45 poäng eller mer efter avslutad giv byter man inte kort i senare givar.
- Chicago-bud: åtagande att ta alla fem stick, kräver minst 15 poäng. Lyckat: +15. Bruten (motståndare tar ett stick): −15 och given avslutas direkt utan poäng för sista sticket eller sluthand.

### Dokumenterade tolkningar
- Sluthand poängsätts på handen efter tredje köpet (kort som spelats till sticken är borta ur handen).
- Vid lyckat Chicago-bud får budgivaren endast +15 poäng; sista sticket och sluthandspoäng utgår den given.
- Första sticket spelas ut av spelaren efter givaren; därefter leder stickvinnaren.
- Oavgjort i toppen vid partislut: partiet fortsätter.

## Teknik

Vanlig HTML/CSS/JS (ES-moduler), inget byggsteg, inga beroenden. Spelmotorn i `js/engine.js` är ramverksfri, serialiserbar och UI-oberoende, och kan köras node-mässigt på en server.

## Arkitektur (förberett för riktiga spelare)

Tre skikt hålls isär så att en framtida nätverksspelare kan bytas in utan att regler eller UI ändras:

1. `js/engine.js` – regler och speltillstånd. Ramverksfri, serialiserbar (toJSON/fromJSON) och UI-oberoende; kan köras i node på en server. All kommunikation går via händelser (onEvent) och ett enhetligt beslutsgränssnitt: motorn ställer en fråga i `awaiting` ({player, action, ...}) och en aktör (lokal spelare, bot eller framtida nätverksplayer) svarar genom att anropa samma metoder (exchange, resolveOpen, bidChicago, passChicago, playCard).
2. `js/bot.js` – beslutspolicy för datorspelare. Ren funktion av handen och läget; samma gränssnitt som en riktig spelare skulle ha.
3. `js/app.js` – UI, sparade partier och arkiv. Läser bara speltillståndet och ritar; vet inte vem som fattar besluten.

När onlinespel byggs (se Roadmap nedan) kör servern skikt 1, varje klient skikt 3, och skikt 2 ersätts av nätverksinmatning för den fjärranslutna spelaren. Ingen nätverkskod finns i dag.

## Roadmap: onlinespel

GitHub Pages är statisk värd och kan inte köra en WebSocket-server. Plan:

1. Frontend ligger kvar på GitHub Pages.
2. En liten auktoritativ server kör `engine.js` och Copilot löser matchmaking/rum via Socket.io eller råa WebSockets.
3. Gratisvärd: Cloudflare Workers med Durable Objects (gratisnivån stödjer WebSockets) eller Supabase Realtime (gratisnivå). Ingen kostnad i något av fallen.

## Kör lokalt

`python3 -m http.server` i katalogen och öppna http://localhost:8000. Tester: `node test.js`.
