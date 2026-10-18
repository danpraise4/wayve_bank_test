# Architecture

The app is split so that screens do not own banking rules.

```
src/domain        Money, dates, validation, list rules, transfer state machine, customer errors
src/api           HTTP client and response parsers
src/services      Transfer controller: lock, persistence, submit, reconcile
src/state         Query client, mock session, scenario switch, draft, privacy preference
src/screens       Screen orchestration
src/components    Buttons, fields, status, rows, quote
src/app           Expo Router routes
mock-server       Deterministic HTTP API used by the app and the integration tests
```

## State

Server data (account, banks, transactions, details) lives in TanStack Query. The query key for history includes every active filter, so a new search does not reuse the previous page list. `signal` from the query function is passed to `fetch`, which aborts the previous request when the key changes.

A second guard, `createLatestQuery`, is used for account-name enquiry and is unit tested for the case where an older search resolves last. The visible list is also protected because it only reads the current query key. Both layers are documented in the technical note.

The balance hide/show flag is persisted with Zustand and AsyncStorage. Until that value has rehydrated, the home screen shows a skeleton instead of the amount, so a hidden balance cannot flash on screen after a restart.

The in-progress transfer is not kept only in memory. The controller writes it to AsyncStorage before the network call. On launch, the root layout calls `resume()`, which looks the transfer up and does not create another one.

## Transfer state machine

`reduceTransferIntent` is a pure function. The controller is the only place that decides to POST or GET.

Unresolved phases are `submitting`, `unknown`, and `pending`. While one of those is stored, `confirm()` will not mint a new idempotency key. A definitive 4xx rejection, other than session expiry, becomes `failed`. Timeouts, network loss, and 5xx responses become `unknown`, and the controller then GETs `/transfers/by-idempotency/:key`.

## Errors

`ApiError.customerMessage` comes from a fixed map. Parsers reject malformed payloads before they reach the screen. Logs go through `redactPath` and, if a body were logged, `redactForLog`. The HTTP client logs only method, redacted path, status, and error code.

## Navigation

Expo Router provides the native stack, including the Android back button and horizontal transitions. `openScreen` ignores a second tap on the same route within 700ms. Confirming a transfer uses `router.replace` for the receipt so the review button is not left underneath the result. The receipt hides the header back button and offers Done.

If the session expires, the root layout unmounts the stack and shows the session screen. Cached queries are cancelled and cleared first.

## What I would not add

There is no generic repository framework and no separate use-case class per endpoint. The transfer controller is the one orchestration object that earns its keep, because the POST/GET decision has to stay in one place.
