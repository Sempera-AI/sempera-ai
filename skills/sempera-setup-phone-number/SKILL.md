---
name: sempera-setup-phone-number
description: Check which phone numbers an agent has, bind a number you own to an agent, and confirm texting numbers. Use when the user wants an agent to answer a phone line.
---

# Set up a phone number

Binding points a number you already own at an agent. The API does not search for, buy or release numbers; that happens in the Sempera App and with your carrier.

## Steps

1. **See what exists.**
   - Numbers bound to one agent, with the carrier readback that shows where each really points: `GET /v1/phone-numbers?agent_id=...` (MCP `list_phone_numbers`; CLI `sempera numbers list --agent <id>`).
   - Numbers that can send and receive texts: `GET /v1/sms/numbers` (`list_sms_numbers`; `sempera numbers list --sms`).
2. **Make sure the agent is published.** Callers reach a published version only. See `sempera-build-agent` and `GET /v1/agents/{agent_id}/versions`.
3. **Bind, with the user's explicit yes and the exact number.** Needs the `owner` role and `phone_numbers:write`:

   ```bash
   curl -sS -X POST https://api.sempera.org/v1/phone-numbers \
     -H "Authorization: Bearer $SEMPERA_API_KEY" \
     -H "Idempotency-Key: $(uuidgen)" \
     -H "Content-Type: application/json" \
     -d '{"agent_id": "northwind-barbers", "number": "+14165550199"}'
   ```

   Binding is what makes a real call storable at all: calls to an unbound number are never stored. A number the workspace does not own or cannot use is refused; report the error as is.
4. **Verify.** Read `GET /v1/phone-numbers?agent_id=...` again and check the number appears and its readback points where expected. Do not call it done until it does.
5. **Texting** is a per-agent setting in the Sempera App (Send text messages) and starts off. A number appears in `GET /v1/sms/numbers` only once texting is on for its agent.

## Rules

- Never bind a number the user did not name.
- Do not place a test call to prove it works unless the user names the person to call and follows the `sempera-send-call` skill.
- If the bind is refused for setup or entitlement reasons, stop and tell the user what the error says; do not retry with variations.
