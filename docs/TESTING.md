# Testing

`npm test` is deterministic and does not call a host outside this machine. The integration suite boots the mock server on an ephemeral port.

## Covered

- Amount parsing, formatting, and the floating-point traps `1.005` and tier boundaries
- Fee tiers and total debit in minor units
- Account number, limit, narration, and balance validation
- Combined filters and inclusive WAT dates
- Duplicate transaction ids across pages, including a status update that keeps the original position
- Stale search results, search debounce, repeated navigation taps, and single-flight refresh
- Transfer locking, timeout followed by lookup, restart from a persisted `submitting` record, rejection, and same-key retry
- The HTTP journey: resolve account, price the debit, submit, replay the same key, open the receipt
- Timeout against the mock, duplicate pages, raw error redaction, session expiry, malformed details, not found, and insufficient funds
- The pending fixture becoming successful on the second read
- Rendered quote totals and status labels for failed, reversed, and pending

## Not covered, and why

- VoiceOver, TalkBack, and a full contrast audit on a device. Labels and 44–48pt targets are in the components, but a screen reader pass is manual.
- A real OS process kill. Restart is tested by constructing a new controller over the same repository, which is the state a relaunch would read.
- Clipboard, Android back, and keyboard avoidance on a simulator. Those are Expo Router and React Native behaviours and were not driven by the component suite.
- Screenshot pixel diffs.
- Multi-server idempotency, certificate pinning, and a real core-banking timeout. The mock is one process with an in-memory map.
- Load testing a very large history. The list is windowed with `FlatList`, and the seeded history is a few dozen rows.

## How to demonstrate the scenarios

Load the app against `npm run server`, then open Tools.

1. Search `merchant`, then quickly `transfer`, with **Out-of-order search** on. The list should settle on transfer.
2. Enable **Duplicate page row**, open History, and scroll. The repeated id appears once.
3. Enable **Uncertain transfer** and confirm a transfer. The receipt says it is being verified. The mock log or a second check shows the original key, not a new transfer.
4. Open **Status watch demo** and wait. The badge moves from Pending to Successful.
5. Load History, enable **Refresh fails**, and pull to refresh. The rows stay, with an error banner.
6. Enter `1999.99` or `5000.01` and read the fee and total on the amount screen.
7. Enable **Uncertain transfer**, confirm, then reload the app before Done. Home shows the verification card and does not send a second transfer.
8. Enable **Session expired** and pull to refresh. The session screen replaces the banking screens.
