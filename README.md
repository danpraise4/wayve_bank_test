# Wayve Mobile Challenge

A React Native banking module for the Wayve Microfinance Bank mobile engineering assessment. It talks only to the local mock API in this repository. It does not connect to a real bank and it does not use real customer data.

## Stack

- Expo SDK 58, React Native, TypeScript with `strict` enabled
- Expo Router, which is built on React Navigation
- TanStack Query for server state, caching, cancellation, and pagination
- Zustand for the transfer draft, the mock session, and the balance-privacy preference
- AsyncStorage for the privacy preference and any transfer whose outcome is not yet known
- A Node mock API with deterministic failure scenarios

Why these libraries: TanStack Query already deduplicates refreshes, keeps the last successful result when a refetch fails, and aborts the previous request when a query key changes. Zustand is enough for small client-only state without hiding business rules inside a global store. Money, validation, idempotency, and stale-response rules live in plain TypeScript modules so they can be tested without rendering the app.

## Setup

Requirements: Node.js 22 or newer, npm, and a phone simulator or Expo Go. Web is supported for review.

```bash
npm install
npm install --prefix mock-server
```

Start the mock API:

```bash
npm run server
```

The API listens on `http://localhost:4010`. Override the app's base URL with `EXPO_PUBLIC_API_URL` if needed. On an Android emulator, use `http://10.0.2.2:4010`.

Start the app:

```bash
npm start
```

Then press `i` for iOS, `a` for Android, or `w` for web. The web bundle is also `npm run web`.

## Tests

```bash
npm test
```

That runs three suites:

- `npm run test:unit` — money, validation, filtering, duplicate pages, stale responses, transfer rules
- `npm run test:integration` — the transfer journey and failure scenarios against the mock HTTP service
- `npm run test:components` — rendered amount, fee, total, and status labels

`npm run typecheck` runs `tsc --noEmit`. The mock server has its own check: `npm --prefix mock-server run typecheck`.

## What the app does

- Account overview with greeting, account number copy, hideable balance, recent transactions, and quick actions
- Transaction history with combined search, type, status, and date filters, plus infinite scroll
- Transaction details for every status, including a pending payment that becomes successful while the screen is open
- A mock transfer flow: bank, account enquiry, amount, review, confirm, receipt
- Recovery for slow responses, timeouts, duplicate confirmation, rejection, insufficient balance, and an app restart while a transfer is unresolved
- Session expiry that clears cached banking data and does not retry forever
- Assessment tools (Home → Tools) that switch the mock scenario

Screenshots of the web build are in [docs/screenshots](docs/screenshots).

## Known limitations

- The mock stores idempotency keys in one process. A restart of the API forgets them. That is not a production financial guarantee.
- The session is a fixed demo token. There is no login, refresh token, or device binding.
- Assessment tools send `X-Wayve-Scenario`. A customer build would not expose that control.
- Screen-reader passes, a real OS process kill, and Android hardware-back automation are documented as manual in [docs/TESTING.md](docs/TESTING.md). Restart is covered by restoring the saved transfer intent.

## Documents

- [Architecture](docs/ARCHITECTURE.md)
- [API contract](docs/API.md)
- [Technical note](docs/TECHNICAL-NOTE.md)
- [Testing notes](docs/TESTING.md)

## AI tools

This submission was built with Cursor using Grok 4.7. The design, the failure handling, and the code in the repository were written in that session and should be explained from this codebase, not from a generated template. See [docs/TECHNICAL-NOTE.md](docs/TECHNICAL-NOTE.md).
