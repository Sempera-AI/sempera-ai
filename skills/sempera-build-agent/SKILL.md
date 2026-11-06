---
name: sempera-build-agent
description: Create a Sempera AI phone agent, edit its draft (instructions, voice, language), try it with a typed preview and publish it. Use when the user wants to build, change or publish a Sempera agent.
---

# Build a Sempera agent

An agent has one editable draft and a list of immutable published versions. Calls always run a published version. All routes are on `https://api.sempera.org` and take `Authorization: Bearer $SEMPERA_API_KEY`. Never print the key or paste it into a file.

## Before you start

1. Check the key: `GET /v1/me` (MCP tool `get_credential`). Creating and editing a draft needs `agents:write`; publishing needs `agents:publish` and the `owner` role. If a scope is missing, tell the user which one and stop. Do not look for another key.
2. Use a synthetic or the user's own business name. Never invent facts about a real business (hours, prices, policies): ask the user, or leave the line out.

## Steps

1. **Create the draft.** Send an `Idempotency-Key` (a fresh UUID):

   ```bash
   curl -sS -X POST https://api.sempera.org/v1/agents \
     -H "Authorization: Bearer $SEMPERA_API_KEY" \
     -H "Idempotency-Key: $(uuidgen)" \
     -H "Content-Type: application/json" \
     -d '{"name": "Northwind Barbers"}'
   ```

   The answer carries the agent `id`. `template` and `answers` are optional.

2. **Read the draft.** `GET /v1/agents/{agent_id}/draft` returns the `revision` and `editable_fields`, the only keys a `PATCH` may carry. `GET /v1/agents/{agent_id}` shows their current values.

3. **Edit the draft** with the revision you just read. A stale revision is refused with `409 conflict`; read again and retry, never overwrite blindly:

   ```bash
   curl -sS -X PATCH https://api.sempera.org/v1/agents/$AGENT_ID/draft \
     -H "Authorization: Bearer $SEMPERA_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"fields": {"instructions": "..."}, "expect_revision": "<revision>"}'
   ```

   A voice is set as `{"voice": {"id": "voice_...", "name": "..."}}`; `GET /v1/voices` lists the ids.

4. **Try it.** `POST /v1/agents/{agent_id}/preview` with one caller turn (`{"message": "..."}`) runs against the draft by default; pass the returned `session_id` to continue. This costs no phone call and contacts nobody. Read the reply critically and fix the instructions rather than assuming it works.

5. **Publish, only with the user's explicit yes.** Publishing makes the draft live for callers:

   ```bash
   curl -sS -X POST https://api.sempera.org/v1/agents/$AGENT_ID/publish \
     -H "Authorization: Bearer $SEMPERA_API_KEY" \
     -H "Idempotency-Key: $(uuidgen)"
   ```

   Then `GET /v1/agents/{agent_id}/versions` shows the new immutable version.

6. **Roll back if needed.** `POST /v1/agents/{agent_id}/rollback` with `{"to_deployment_id": "..."}` creates a new rollback record; history is never rewritten.

## Rules

- Do not publish, archive or delete without the user saying so in this conversation.
- A failed or unavailable preview is not a pass. Report it as it is.
- Phone numbers are a separate step: see the `sempera-setup-phone-number` skill.
