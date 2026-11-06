---
name: sempera-debug-call
description: Work out why a Sempera call or conversation went wrong, from the call record, transcript, tool timeline and webhook delivery. Use when a call failed, an agent said something wrong, or a webhook did not arrive.
---

# Debug a call

Read first, change nothing until you know the cause.

## Steps

1. **Get the record.** `GET /v1/calls/{call_id}` (MCP `get_call`; CLI `sempera calls get <id>`). Note the status, direction, duration and the agent version that took it. If you only have an agent, `GET /v1/calls?agent_id=...` lists newest first.
2. **Read the conversation.** `GET /v1/sessions/{call_id}` (`get_conversation`) gives the turns, the tool timeline, captured variables, outcome and the version that spoke. Find the first turn where the call went wrong.
3. **Classify.**
   - *Wrong words*: the instructions or knowledge of that version are at fault. Read that version with `GET /v1/agents/{agent_id}/versions/{version_id}`, reproduce with a typed turn, `POST /v1/agents/{agent_id}/preview` with `{"message": "..."}` (its `version` field defaults to `draft`), fix the draft, and follow `sempera-build-agent`.
   - *A tool failed*: the tool timeline shows the failing step. Fix the tool or the system it calls; do not change the agent's words to hide it.
   - *No call happened*: for an outbound call, read the refusal. Common ones are outside calling hours (`409`, `outside_sending_hours`), the number on the do-not-contact list, a reached outbound cap (`429 rate_limited` with `retry_after_s`) and a missing scope (`403 insufficient_scope`). These are working as designed; report them.
   - *Call not stored*: the number may not be bound to the agent. Check `GET /v1/phone-numbers?agent_id=...`.
4. **A webhook did not arrive.** `GET /v1/webhooks/{id}/deliveries` is the delivery log, one row per attempt. Check the endpoint is enabled and subscribed to the event, and that your server answered `2xx` within 10 seconds. `POST /v1/webhooks/{id}/test` sends one signed `webhook.test`.
5. **A signature does not verify.** The header `X-Sempera-Signature` is `t=<unix seconds>,v1=<hex>`, the HMAC-SHA256 of `"<t>." + raw_body` keyed with the endpoint secret. Verify the exact raw bytes before parsing JSON. To check a captured delivery locally: `sempera webhooks verify --signature '<header>' --body-file body.json` with `SEMPERA_WEBHOOK_SECRET` set, or the MCP tool `verify_webhook_signature`. Delivery is at least once: drop repeats by `X-Sempera-Event-Id`.
6. **Ask the user for the missing piece, not for a larger key.** If a read is refused for scope, say which scope.

## Rules

- Quote the API's error `code` and `request_id`; they are what support needs.
- Transcripts hold personal data: summarise, do not paste them elsewhere.
- Do not place a new call to reproduce a problem unless the user names the person and confirms (`sempera-send-call`).
