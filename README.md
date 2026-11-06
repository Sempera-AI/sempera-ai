# Sempera for AI coding agents

[Documentation](https://docs.sempera.org) | [MCP guide](https://docs.sempera.org/mcp) | [OpenAPI document](https://api.sempera.org/openapi.json) | [MIT licence](LICENSE)

Skills, a plugin and editor rules that teach an AI coding agent to build and operate [Sempera](https://sempera.org) phone agents: create and publish an agent, place a call or send a text, read conversations, set up a number and debug a call.

Everything here uses only the public API at `https://api.sempera.org` (contract: [`/openapi.json`](https://api.sempera.org/openapi.json)) with your workspace API key.

## What is inside

| Path | What it is |
|---|---|
| `skills/sempera-build-agent` | Create an agent, edit its draft, try it with a typed preview, publish |
| `skills/sempera-send-call` | Place one real call or send one real text, with consent and confirmation |
| `skills/sempera-read-conversations` | List and read calls and conversations with transcripts |
| `skills/sempera-setup-phone-number` | Check, bind and verify a number you own |
| `skills/sempera-debug-call` | Find out why a call, a tool or a webhook went wrong |
| `.claude-plugin/plugin.json` | Plugin manifest for Claude Code |
| `.codex-plugin/plugin.json` | Plugin manifest for Codex |
| `.mcp.json` | Bundles the [`@sempera/mcp`](https://github.com/Sempera-AI/sempera-mcp) server (read tools only) |
| `rules/sempera.mdc` | A rule file for Cursor-style editors |

## Install

Create an API key in the Sempera App under Settings, API keys. Give it only the scopes you want your coding agent to have.

### Claude Code

```bash
# From a clone of this repository
claude --plugin-dir ./sempera-ai
```

The plugin asks for your API key once and passes it to the bundled MCP server. Or copy a skill folder from `skills/` into `~/.claude/skills/` to use one skill alone.

### Codex

Add this directory as a plugin (it carries `.codex-plugin/plugin.json`), or copy the folders from `skills/` into your Codex skills directory. Set `SEMPERA_API_KEY` in the environment the bundled server runs in.

### Cursor and other editors

Copy `rules/sempera.mdc` to `.cursor/rules/sempera.mdc` in your project. For the MCP server, add it to your client's config:

```json
{
  "mcpServers": {
    "sempera": {
      "command": "npx",
      "args": ["-y", "@sempera/mcp"],
      "env": { "SEMPERA_API_KEY": "<your API key>" }
    }
  }
}
```

## Quick start

Ask your coding agent, in plain words:

- "List my Sempera agents and show the last five calls of the first one." (read-only)
- "Build a Sempera agent for Northwind Barbers that books haircuts, and preview it." (stops before publishing)
- "Why did call call-123 end early?" (reads the transcript and tool timeline)

## Safety

- Writes that reach people are never defaulted. A call or text needs the agent, the number and a consent sentence from you, and the agent asks you to confirm first.
- Publishing, binding a number and deleting need your explicit yes.
- The bundled MCP server starts read-only. Turning on `send_call` and `send_sms` (`--allow-writes`) is your decision, in your config.
- The skills tell the agent to keep the API key and call transcripts out of files, commits and tickets.
- The API still enforces calling hours, the do-not-contact list, opt-outs, caps and billing, whatever the agent asks.

## Test

```bash
npm test
```

The tests mock the HTTP layer: they replay every `curl` example in the skills against a fake API that knows the public routes, and check the manifests and rules. They prove the files are consistent, not live API behaviour.

## Licence

MIT. Copyright Sempera Labs, Inc.
