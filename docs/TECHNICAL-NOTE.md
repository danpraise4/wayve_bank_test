# Technical note

## Uncertain transfer outcomes

Confirming a transfer generates one idempotency key and writes a `submitting` record to AsyncStorage before `POST /api/v1/transfers`. The client aborts that POST after 8 seconds.

If the call times out, the network fails, or the server returns 5xx, the record becomes `unknown`. The controller then calls `GET /api/v1/transfers/by-idempotency/:key`. It does not POST again as part of that recovery.

- A found transfer adopts the server status. Pending stays pending and is polled. Successful, failed, and reversed are terminal and are labelled differently.
- A `404` stays `unknown` with copy that says the bank has no record yet. Checking again is another GET.
- Only an explicit "Submit the original request" action POSTs, and it reuses the original key. If the first request arrives late, the mock returns the original transfer instead of creating a second one.
- Session expiry is also treated as uncertain for the transfer, and the session handler clears cached account data. It does not start a new transfer.

The timeout scenario stores the transfer and then waits longer than the client. The integration test uses a 40ms client timeout and a 200ms server delay, then asserts there was one POST and the lookup found the pending transfer.

## Duplicate submissions

Three separate mechanisms are required, because a disabled button does not cover a double tap that already passed the button, a retry, or a process restart.

1. `confirm()` stores the in-flight promise synchronously. A second tap receives that same promise.
2. The reducer ignores `start` while a record is `submitting`, `unknown`, or `pending`, so a new key cannot replace an unresolved one.
3. The server treats the key as idempotent. Replaying the same body returns the same `transactionId`.

A definitive rejection, such as insufficient funds, is terminal. A later transfer is a new customer intent and gets a new key. `retrySameKey()` refuses to run unless the phase is `unknown` and a lookup has already returned not found.

## Stale responses

History search is debounced by 300ms. The React Query key contains the debounced search plus type, status, and dates, and the query starts again at page 1 when that key changes. The query function passes `AbortSignal` through to `fetch`.

`createLatestQuery` additionally aborts the previous enquiry or search and drops a response whose token is no longer current. The unit test resolves the `merchant` request after the `transfer` request and asserts that only `transfer` is applied. The integration test does the same against the mock's delayed `merchant` search.

Refreshing uses `singleFlight`, and TanStack Query also deduplicates a refetch of the same key. A failed refresh does not clear `data`. `describeQueryState` maps "has data and has error" to `refresh-error`, which keeps the list and shows a banner. An empty list with no error is a different state from a failed request.

Pagination merges pages with `mergeTransactionPages`. The first time an id is seen fixes its position. A later copy can update fields, including status, but cannot insert a second row. The duplicate-page scenario is covered by a unit test and by the integration test.

## Money

Customer input is parsed from the string. Digits before the decimal point and at most two digits after it are concatenated into kobo. `10.10` becomes `1010`. `1,999.99` becomes `199999`. There is no `parseFloat` and no `amount * 100`.

Fees and the total debit use integer addition with a safe-integer check. The ₦1,999.99 case plus a ₦10.00 fee is exactly ₦2,009.99 (`200999` kobo). The ₦5,000.01 case crosses a fee tier and totals ₦5,025.01 (`502501` kobo). Formatting prints the last two digits as kobo rather than dividing in binary floating point.

## Before production

- Replace the mock token with a real session, short-lived access tokens, and refresh that cannot loop.
- Persist idempotency keys in a durable store on the server, with a unique constraint, and keep that store across crashes and multiple app instances. The in-memory mock is not that store.
- Make transfer status authoritative on the server. The client poll is a hint. Unknown outcomes need an operations path, not only a button.
- Pin certificates, sign requests, and keep account numbers out of analytics. Redaction in this app covers logs, not every native crash reporter.
- Add device binding, step-up authentication, and a server-side limit check that does not trust the fee the client displays.
- Replace the demo Tools screen and the scenario header. They exist so a reviewer can force failures.
- Run the failure drills on iOS and Android, including process death during `submitting`, with VoiceOver and TalkBack.

## Not automated

See [TESTING.md](TESTING.md).

## AI disclosure

Cursor with Grok 4.7 was used to design and write this submission. I reviewed the transfer state machine, the minor-unit parser, and the mock scenario behaviour against the assessment scenarios. The mock idempotency map must not be described as a production guarantee; the technical note above is the intended explanation.
