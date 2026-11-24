# Chicago online

Kortspelet Chicago (svenska regler) i webbläsaren, mobilanpassat. Spela mot datorn.

## Regler (källa: qort.se/chicago, PDF-reglerna)

- 2–4 spelare, 52 kort utan jokrar, 5 kort var, resten är talong.
- Varje giv: tre köprundor (byt valfritt antal kort, dra lika många), sedan fem stick utan trumf. Följ utspelsfärgen om du kan, högsta kortet i utspelsfärgen vinner.
- Poäng för bästa pokerhand efter köp 1, köp 2 och efter sticken (sluthand). Par 1, två par 2, triss 3, stege 4, färg 5, kåk 6, fyrtal 7, färgstege 8, royal straight flush 52. Exakt lika bästa händer ger ingen poäng, och inga poäng utan par eller bättre.
- Sista sticket ger 5 poäng. Först till 52 poäng när given är färdig vinner; flera över 52: högsta total vinner.
- Köpstopp: vid minst 46 poäng efter avslutad giv byter man inte kort i senare givar.
- Chicago-bud: åtagande att ta alla fem stick, kräver minst 15 poäng. Lyckat: +15. Bruten (motståndare tar ett stick): −15 och given avslutas direkt utan poäng för sista sticket eller sluthand.

### Dokumenterade tolkningar
- Sluthand poängsätts på handen efter tredje köpet (kort som spelats till sticken är borta ur handen).
- Vid lyckat Chicago-bud får budgivaren utöver +15 även sista sticket (+5) och sluthandspoäng.
- Första sticket spelas ut av spelaren efter givaren; därefter leder stickvinnaren.
- Oavgjort i toppen vid partislut: partiet fortsätter.

## Teknik

Vanlig HTML/CSS/JS (ES-moduler), inget byggsteg, inga beroenden. Spelmotorn i `js/engine.js` är ramverksfri, serialiserbar och UI-oberoende, och kan köras node-mässigt på en server.

## Roadmap: onlinespel

GitHub Pages är statisk värd och kan inte köra en WebSocket-server. Plan:

1. Frontend ligger kvar på GitHub Pages.
2. En liten auktoritativ server kör `engine.js` och Copilot löser matchmaking/rum via Socket.io eller råa WebSockets.
3. Gratisvärd: Cloudflare Workers med Durable Objects (gratisnivån stödjer WebSockets) eller Supabase Realtime (gratisnivå). Ingen kostnad i något av fallen.

## Kör lokalt

`python3 -m http.server` i katalogen och öppna http://localhost:8000. Tester: `node test.js`.
