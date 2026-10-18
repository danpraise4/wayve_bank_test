# Mock API

Start it with `npm run server`. It listens on port `4010` unless `PORT` is set. The demo bearer token is `demo-session-token`. The app sends it from memory and does not write it to disk.

All amounts ending in `Minor` are integer kobo. ₦1.00 is `100`.

## Account

`GET /api/v1/account`

```json
{
  "accountId": "acc_001",
  "accountNumber": "0123456789",
  "accountName": "Ada Okafor",
  "currency": "NGN",
  "availableBalanceMinor": 25000000
}
```

The opening balance is ₦250,000.00. A successful or pending transfer reduces it by the amount plus the fee.

## Banks

`GET /api/v1/banks`

Extension. Returns `{ code, name }[]`. Wayve's code is `000001`.

## Transactions

`GET /api/v1/transactions?page&limit&search&type&status&from&to`

`from` and `to` are `YYYY-MM-DD` calendar days in West Africa Time (UTC+1), inclusive. Filters are combined with AND. Search matches description or reference, case-insensitively.

`GET /api/v1/transactions/:id`

Includes `feeMinor`, `narration`, and `counterparty` when the fixture has them.

`txn_status_watch` ("Status watch demo") is pending on the first read and successful from the second read. That drives the details-screen status transition.

## Account enquiry

`POST /api/v1/transfers/resolve-account`

```json
{ "bankCode": "000013", "accountNumber": "1029384756" }
```

```json
{
  "accountName": "Chinedu Adeyemi",
  "bankCode": "000013",
  "bankName": "GTBank",
  "accountNumber": "1029384756"
}
```

`bankName` is an extension. Unknown accounts return `404` with code `INVALID_ACCOUNT`.

Known counterparties include Chinedu Adeyemi (`000013` / `1029384756`), Fatima Bello (`000014` / `5647382910`), John Okon (`000015` / `9081726354`), Ngozi Eze (`000016` / `1122334455`), Ibrahim Musa (`000017` / `9988776655`), and Kunle Balogun (`000001` / `1234567890`).

## Transfer

`POST /api/v1/transfers`

```json
{
  "recipientBankCode": "000013",
  "recipientAccountNumber": "1029384756",
  "amountMinor": 150050,
  "narration": "Personal transfer",
  "idempotencyKey": "wayve_..."
}
```

```json
{
  "transactionId": "txn_transfer_001",
  "reference": "WAYVE-TRANSFER-001",
  "status": "successful",
  "amountMinor": 150050,
  "feeMinor": 1000,
  "totalDebitMinor": 151050,
  "currency": "NGN",
  "idempotencyKey": "wayve_..."
}
```

`feeMinor`, `totalDebitMinor`, and `idempotencyKey` on the response are extensions. The fee matches the client schedule: ₦10.00 up to ₦5,000.00, ₦25.00 up to ₦50,000.00, otherwise ₦50.00.

The same key and the same body return the original transfer. The same key with a different body returns `409 IDEMPOTENCY_CONFLICT` and does not create a second transfer.

`GET /api/v1/transfers/by-idempotency/:key`

Returns the stored receipt, or `404 TRANSFER_NOT_FOUND`. For the timeout scenario, the stored transfer starts pending and becomes successful on the second status read.

## Scenarios

Send `X-Wayve-Scenario`. Optional `X-Wayve-Delay-Ms` overrides the wait. The in-app Tools screen sets the scenario header on later requests.

| Scenario | Behaviour |
| --- | --- |
| `slow` | Waits about 2.5 seconds |
| `timeout` | Stores the transfer, then waits 12 seconds before responding |
| `pending` | Accepts the transfer as pending |
| `reject` | `422 TRANSFER_REJECTED`, nothing stored |
| `insufficient` | `422 INSUFFICIENT_FUNDS`, nothing stored |
| `session-expired` | `401 SESSION_EXPIRED` |
| `duplicate-page` | Page 2 repeats the last id from the previous page |
| `refresh-fail` | Account and transaction list return `503` with a deliberately unsafe message |
| `out-of-order` | A `merchant` search is slower than a `transfer` search |
| `malformed` | Transaction payload fails parsing |
| `not-found` | Transaction details return `404` |

The unsafe `503` message includes a fake host and token. The client must not show it. Tests assert that.

## Limits of this mock

Idempotency here is an in-memory map inside one Node process. It dies when the process restarts, it is not shared across servers, and it is not a production financial guarantee. The client still has to persist its own key and avoid a blind second POST. That client behaviour is what the assessment is measuring.
