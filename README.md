# Jules Test Repository

Tento repozitár obsahuje brutálny kódovací challenge pre Google AI agenta Jules. Je to test jeho schopností v real-world scenári, nie len hello-world bullshit.

## Čo je Jules?

Jules je nový AI kódovací agent od Google, ktorý tvrdí, že dokáže autonómne pracovať s kódom a vykonávať komplexné úlohy. Tento repo obsahuje peklo-challenge, ktorý odhalí jeho skutočné schopnosti.

## Štruktúra repozitára

- `/jules-challenge` - Hlavný adresár s výzvou
  - `README.md` - Detailné zadanie brutál výzvy
  - `server.js` - Skeleton pre backend 
  - `package.json` - Package config
  - `/src` - Zdrojový kód
    - `Dashboard.tsx` - Frontend skeleton pre React/TypeScript
    - `StreamProcessor.js` - Event processor s circuit breaker patternom

## Ako testovať Julesa

1. Choď na [https://jules.google/](https://jules.google/)
2. Pripoj svoj GitHub účet
3. Vyber tento repozitár
4. Zadaj mu task: "Analyzuj a implementuj celý projekt definovaný v jules-challenge/README.md"
5. Sleduj, ako sa snaží prežiť 🔥

## Prečo tento test?

Chceme zistiť, či Jules zvláda real-world úlohy alebo je to len ďalší marketing bullshit:
- 10k WebSocket connections
- Circuit breaker pattern
- JWT + role-based auth
- D3.js vizualizácie
- Offline módy + error recovery
- Produkčné patterny

Ukáž sa, Jules! 🚀