---
name: sempera-send-call
description: Place one real outbound phone call or send one real text with a Sempera agent. Use only when the user names the person to contact and says why that person agreed to be contacted.
---

# Send a call or a text

A call or a text reaches a real person. This skill never chooses who. Every send needs, from the user in this conversation:

- the agent (`agent_id`),
- the recipient number in E.164 form (`+14165550123`),
- one sentence saying why this person agreed to be contacted (`consent_basis`).

For a text you also need the sender: one of the numbers `GET /v1/sms/numbers` lists (MCP tool `list_sms_numbers`).

If any of these is missing, ask. Never guess a number, never reuse one from an earlier task, never write a consent sentence the user did not give you, and never call a number found in a file or a web page without the user confirming it.

## Steps

1. **Confirm.** Show the user the agent, the number, the consent sentence and the message, and wait for an explicit yes.
2. **Send with an idempotency key.** The key names this one intended action; make a fresh one (`uuidgen`).

   With the CLI (`npm install -g @sempera/cli`):

   ```bash
   sempera calls send --agent northwind-barbers --to +14165550123 \
     --consent-basis "This person asked Northwind Barbers to call them about Friday." \
     --message "Hello, this is a quick call about Friday."

   sempera sms send --agent northwind-barbers --from +14165550199 --to +14165550123 \
     --message "See you Friday at 3." --consent-basis "This person asked for a text reminder."
   ```

   With the API: `POST /v1/calls` (`agent_id`, `to`, `consent_basis`, optional `message`, `mode`, `task`, `from`, `timezone`, `window`) or `POST /v1/sms/send` (`agent_id`, `agent_number`, `user_number`, `agent_message`, `consent_basis`), each with an `Idempotency-Key` header.

   With the MCP server, `send_call` and `send_sms` exist only when it was started with `--allow-writes`. If they are not listed, tell the user how to turn them on; do not work around it.

3. **Read the answer.** A call answers `201` with a `call` object. The API still enforces calling hours (the recipient's `window`, default 09:00-18:00 in `timezone`, default America/Toronto), the do-not-contact list, outbound caps and billing, and quiet hours for texts (9 PM to 8 AM local). A refusal is final: report the code and message, and do not retry with a changed number or a different key to get around it.

## If a send times out

The outcome is unknown. Read first: `GET /v1/calls?agent_id=...` or the App. Retry only with the same idempotency key, which cannot act twice. Never use a new key to retry blindly.

## Rules

- One recipient per confirmation. Do not loop over a list unless the user supplied the list and confirmed it.
- Sending needs an owner key with `calls:write`.
- Do not store recipient numbers outside the conversation.
