---
name: sempera-read-conversations
description: List and read Sempera calls and conversations with their transcripts. Use when the user asks what callers said, how a call went, or for recent activity on an agent.
---

# Read calls and conversations

Reads only. Nothing here changes data or contacts anyone. Needs `calls:read` (calls) and `sessions:read` (conversations) on the key.

## Steps

1. **Find the agent.** `GET /v1/agents` (MCP `list_agents`; CLI `sempera agents list`). Use the agent `id` below.
2. **List recent activity.**
   - Phone calls, newest first: `GET /v1/calls?agent_id=...` (`list_calls`, `sempera calls list --agent <id>`).
   - Every channel (phone, web voice, web chat, API chat, simulator, test): `GET /v1/sessions?agent_id=...&channel=...` (`list_conversations`, `sempera conversations list`). `channel` is optional.
   - Lists take `limit` (1 to 200, default 50) and `cursor`. The answer is `{"object": "list", "data": [...], "has_more": true, "next_cursor": "..."}`; pass `next_cursor` back unchanged for the next page.
3. **Read one.**
   - A call: `GET /v1/calls/{call_id}` (`get_call`). It includes the transcript when one is stored.
   - A conversation: `GET /v1/sessions/{session_id}` (`get_conversation`). It includes the turns, the tool timeline, captured variables, outcome and the agent version that spoke.
4. **Summarise for the user.** Quote only what the question needs.

## Handling what you read

- Transcripts contain personal information about callers. Do not copy them into files, commits, tickets or other tools unless the user asks. Prefer a short summary over a full transcript.
- A deleted or expired transcript answers `410`; a call you cannot see answers `404`. Say so rather than guessing.
- A call just placed by `POST /v1/calls` is a dispatch record first; the full transcript appears after the call ends.
- Webhook `call.completed` announces a finished call with its `call_id`; use it here to read the details.
