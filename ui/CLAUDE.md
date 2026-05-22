# btc-test-ui — reguły dla Claude

## Stack

- **JavaScript engine**: Rivets.js (data-binding, bez bundlera — CDN)
- **CSS**: Tailwind CSS CDN z inline config zgodnym z design systemem Precision Ledger (`src/tailwind.config.js`)
- **Testy**: Jest + jsdom + Babel (`npm test`)
- **Serwer**: Express proxy (`../proxy/server.js`) — statyczne pliki z katalogu `ui/`, port 3001

## Architektura — zasady bezwzględne

### Komponenty
- Każdy komponent w `src/components/` eksportuje:
  - `template` — string HTML z atrybutami `rv-*`
  - `createXxxController(props)` — czysty JS (testowalny bez DOM, bez Rivets)
- Komponenty nie wykonują bezpośrednich zapytań HTTP. Dane dostają przez props/callback.
- Nie duplikuj kodu — zamiast kopiować, importuj template + controller z komponentu.

### Widoki (`src/views/`)
- Każdy widok eksportuje `createController({...deps})` + obiekt `XxxView.mount(el, params, deps)`.
- `createController` = czysty JS, testowalny w izolacji.
- `mount` = wstawia template do DOM, tworzy scope, wywołuje `rivets.bind`, zwraca `{ unbind }`.
- Widok **składa** ekran z importowanych template'ów komponentów i scala scope (`...createXxxController()`).
- Pobieranie danych z API — **enkapsulowane w kontrolerze widoku lub komponentu**, nie w routerze.

### Routing (`src/router.js`)
- Hash-based: `#/tenants`, `#/tenants/:id/config`, `#/tenants/new`
- Każdy ekran dostępny **bezpośrednio z URL** — zero modali/popupów jako głównego flow.
- Router czyści poprzedni binding (`unbind()`) przed zamontowaniem nowego widoku.

### Nawigacja breadcrumb (okruszki)
- Każdy podekran (detail view, sub-tab) musi mieć w desktop top barze klikalne okruszki do wszystkich poziomów nadrzędnych.
- Okruszek do listy: `<a rv-on-click="goToList" href="#">Lista</a>` + metoda `goToList(e) { e?.preventDefault(); router.navigate(...); }`.
- Okruszek do encji nadrzędnej (np. customer ID): `<a rv-on-click="goToParent" href="#">` — nawiguje do widoku domyślnego tej encji (np. `/profile`).
- Bieżący poziom (ostatni okruszek) — zwykły `<span>`, bez linku.
- **Wszystkie** handlery klikalne w `rv-on-click` muszą przyjmować `(e)` i wołać `e?.preventDefault()` — inaczej `href="#"` nadpisuje hash na root aplikacji.

### API (`src/api.js`)
- Proxy endpointy: `/admin-api/*` → `/admin/v1/*` (admin key), `/api/*` → `/v1/*` (tenant key)
- Szczegóły endpointów: patrz `../docs/chain_api_mcp_mini_hld_and_agent_prompt.md` rozdział 7 (API Reference)
- Kolekcja Postman: `../docs/btc-chain-api.postman_collection.json`
- `src/rivets.js` = thin wrapper (`export default window.rivets`) — mockowany w testach przez `moduleNameMapper`
- `getActiveTenantKey()` — eksportowana funkcja zwracająca klucz tenanta z `sessionStorage`
- `api.tenantRequest(path, opts)` — wrapper do `/api/*` calls, automatycznie dodaje `X-Tenant-Key` header
- `api.switchTenant(tenantId)` — generuje klucz przez proxy i zapisuje go w `sessionStorage`

## Integracja z backendem

API endpointy backendu (przez proxy):

| Zasób | Metoda | URL | Uwagi |
|---|---|---|---|
| Lista tenantów | GET | `/admin-api/tenants?limit=&cursor=` | cursor-based pagination |
| Szczegóły tenanta | GET | `/admin-api/tenants/:id` | |
| Utwórz tenanta | POST | `/admin-api/tenants` | body: `{ name, assets: [{ chain, hotAddress }] }` |
| Konfiguracja tenanta | GET | `/admin-api/tenants/:id/config` | odpowiedź unwrapowana z `{ data }` |
| Zapisz konfigurację | PATCH | `/admin-api/tenants/:id/config` | klucze camelCase (engine Zod schema) |
| Przełącz aktywny tenant | POST | `/switch-tenant { tenantId }` | zwraca `{ key }` → zapisywany w sessionStorage |
| Konfiguracja proxy | GET | `/config` | |
| RPC Bitcoin Core | POST | `/rpc { method, params }` | |
| Tenant API (przyszłe ekrany) | * | `/api/*` | wymaga aktywnego klucza z switchTenant |

### Konwencje odpowiedzi engine
- Wszystkie odpowiedzi engine są opakowane w `{ data: ... }` — `api.getTenantConfig` unwrapuje automatycznie
- Lista tenantów: `{ data: [...], pagination: { limit, cursor, nextCursor } }` — **brak pola `total`**
- Config fields: klucze **camelCase** (np. `btcConfirmationsRequired`, `custodyMode`) — nie snake_case

Przed rozszerzeniem API — sprawdź kolekcję Postman i HLD sekcja 7 po aktualny schemat requestów i responsów.

## Testy — zasady

- **Testy komponentów**: testuj `createXxxController()` jako czysty JS — stan, metody, walidację, obsługę błędów.
- **Testy widoków**: testuj `createController()` — ładowanie danych, stany loading/error/empty, akcje nawigacji.
- **Mockuj API**: zawsze `jest.fn().mockResolvedValue(...)` / `mockRejectedValue(...)`.
- **Nigdy realnych requestów** w testach.
- Struktura `tests/` odzwierciedla `src/` (`tests/components/`, `tests/views/`).
- Mocki: `tests/mocks/api.js` (`makeMockApi`, `makeRouter`), `tests/mocks/rivets.js`.

## Design system

Źródło prawdy: `../design/precision_ledger_2/DESIGN.md` + `../design/*/screen.png`

- **Kolory**: zdefiniowane w `src/tailwind.config.js` (surface, primary, secondary #ffb874, tertiary #4edea3, error)
- **Glassmorphism**: klasa `.glass-card` w `index.html` (`rgba(30,41,59,0.5)` + `backdrop-blur(20px)`)
- **Typografia**: Geist (nagłówki, liczby, mono-data) + Inter (body text)
- **Spacing**: 8px base scale (`xs`=4, `sm`=12, `md`=24, `lg`=40, `xl`=64)
- Klasy dynamiczne wymagane w Tailwind CDN: dodaj do safelist div w `index.html`

## Layout responsywny

- **Mobile** (`< lg`): `TopAppBar` (fixed top) + treść + `BottomNav` (fixed bottom) + FAB
- **Desktop** (`lg+`): `DesktopSidebar` (280px fixed left) + desktop top bar + treść
- Przełącznik: `lg:hidden` / `hidden lg:flex`
- Mobilny drawer = sidebar wsuwany z lewej, overlay `bg-black/60`

## Rivets.js — pułapki

- `rv-each-tenant="tenants"` → wewnątrz scope to `tenant.*`, nie item
- Metody eventów w `rv-each` muszą być **na obiekcie iterowanym** (nie na scope nadrzędnym)
- Dynamiczne klasy Tailwind z `/` (np. `bg-tertiary/10`) — obliczaj jako string w kontrolerze, używaj `rv-attr-class`
- Gettery JS nie są reaktywne — aktualizuj **jawnie** wszystkie pochodne właściwości po zmianie stanu
- `rv-show`/`rv-hide` = `display:none` (element zostaje w DOM); `rv-if` = usuwa z DOM

## Pliki — co gdzie

```
src/
  app.js              # entry: createRouter + rejestracja tras + start()
  router.js           # createRouter() — hash routing, zarządzanie unbind
  api.js              # api.getTenants / getTenantConfig / saveTenantConfig itd.
  rivets.js           # export default window.rivets
  tailwind.config.js  # tailwind.config = { ... } (plain script, nie module)
  components/         # template + createXxxController
  views/              # createController + XxxView.mount
tests/
  setup.js            # window.rivets mock (setupFiles — BEZ beforeEach)
  mocks/api.js        # makeMockApi(), makeRouter()
  mocks/rivets.js     # moduleNameMapper target
  components/         # *.test.js dla każdego komponentu
  views/              # *.test.js dla każdego widoku
```
