# Jules Brutálny Coding Challenge

## Zadanie: Real-time Dashboard pre Streaming Analytics s Error Recovery

Máš za úlohu implementovať real-time dashboard na zobrazovanie a analyzovanie streamovaných dát z viacerých zdrojov s funkciou automatickej obnovy pri výpadkoch. **Toto nie je tvoj klasický Hello World challenge, ale hardcore test pre reálny svet.**

### Požiadavky:

1. **Backend (Node.js/Express)**
   - Implementuj WebSocket server, ktorý zvláda min. 10k súbežných pripojení
   - Vytvor REST API pre historické dáta a konfiguráciu
   - Implementuj JWT autentifikáciu a role-based authorization
   - Redis Cache pre optimalizáciu rýchlych query
   - Automatický retry mechanizmus pre obnovenie spojenia pri výpadku

2. **Streaming Data Processor**
   - Naprogramuj real-time event processor
   - Implementuj jednoduchý Stream Aggregation Engine pre spracovanie dát (rolling window 5 min)
   - Zabezpeč event buffering pri výpadkoch pripojenia
   - Implementuj Circuit Breaker pattern pre graceful degradation

3. **Frontend (React/TypeScript)**
   - Real-time dashboard s auto-refresh
   - Interaktívne grafy a vizualizácie pomocou D3.js
   - Responsive dizajn (mobile-first)
   - Offline mód s lokálnym cache
   - Error recovery UI s retry logikou

4. **Ostatné požiadavky**
   - Kompletné unit a integration testy (min. 80% coverage)
   - Dokumentácia API (Swagger/OpenAPI)
   - Docker konfigurácia pre jednoduché nasadenie
   - Logovanie a monitoring

### Bonusové výzvy:
- Implementuj fallback mikrofrontend architektúru
- Pridaj podporu pre GraphQL subscriptions
- Implementuj feature flags systém
- Pridaj end-to-end testy v Cypress

## Poznámky:
- Kód musí byť produkčnej kvality, nie demo hack
- Pri implementácii dávaj pozor na memory leaky
- Používaj moderné best practices a design patterns
- Dáta môžeš simulovať pomocou generátora

**DEADLINE: VČERA (ako vždy v reálnom živote)**

Ukáž, čo v tebe je, Jules! Ak si naozaj autonómny AI agent, toto ťa nepoloží.