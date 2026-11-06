// Tests for the Sempera skills, plugin manifests and editor rules. Nothing here reaches a network: the curl
// examples in each SKILL.md are parsed and replayed against a fake HTTP layer that knows the public routes.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILLS = ["sempera-build-agent", "sempera-send-call", "sempera-read-conversations", "sempera-setup-phone-number", "sempera-debug-call"];

// The routes of the public contract these files may mention, with the scope-free shape of each.
// A POST that creates, sends or publishes must carry an Idempotency-Key.
const ROUTES = [
  ["GET", "/v1/me"],
  ["GET", "/v1/agents"],
  ["POST", "/v1/agents", { idempotent: true }],
  ["GET", "/v1/agents/{id}"],
  ["GET", "/v1/agents/{id}/draft"],
  ["PATCH", "/v1/agents/{id}/draft"],
  ["POST", "/v1/agents/{id}/preview"],
  ["POST", "/v1/agents/{id}/publish", { idempotent: true }],
  ["POST", "/v1/agents/{id}/rollback"],
  ["GET", "/v1/agents/{id}/versions"],
  ["GET", "/v1/agents/{id}/versions/{id}"],
  ["GET", "/v1/voices"],
  ["GET", "/v1/calls"],
  ["GET", "/v1/calls/{id}"],
  ["POST", "/v1/calls", { idempotent: true }],
  ["GET", "/v1/sessions"],
  ["GET", "/v1/sessions/{id}"],
  ["GET", "/v1/phone-numbers"],
  ["POST", "/v1/phone-numbers", { idempotent: true }],
  ["GET", "/v1/sms/numbers"],
  ["POST", "/v1/sms/send", { idempotent: true }],
  ["GET", "/v1/webhooks/{id}/deliveries"],
  ["POST", "/v1/webhooks/{id}/test"],
];

function normalise(path) {
  return path.split("?")[0].replace(/\/+$/, "").split("/").map((seg, i, all) => (/^\{.*\}$/.test(seg) || /^\$[A-Z_]+$/.test(seg) || (i > 0 && /^[a-z]+-[a-z0-9-]+$/.test(seg) && ["agents", "calls", "sessions", "versions", "webhooks"].includes(all[i - 1])) ? "{id}" : seg)).join("/");
}

function match(method, path) {
  const want = normalise(path);
  return ROUTES.find(([m, p]) => m === method && p === want);
}

/** A fake fetch: answers 2xx for a known route, 404 otherwise, 401 without a bearer key. */
function fakeApi() {
  const seen = [];
  const fetch = async ({ method, url, headers }) => {
    const path = new URL(url).pathname;
    seen.push({ method, path, headers });
    if (!/^Bearer \S+$/.test(headers.authorization ?? "")) return { status: 401 };
    const route = match(method, path);
    if (!route) return { status: 404 };
    if (route[2]?.idempotent && !headers["idempotency-key"]) return { status: 400, reason: "idempotency_key_required" };
    return { status: 200 };
  };
  return { fetch, seen };
}

/** Pull every `curl ...` command (with backslash continuations) out of fenced bash blocks. */
function curlCommands(markdown) {
  const out = [];
  for (const block of markdown.matchAll(/```bash\n([\s\S]*?)```/g)) {
    const joined = block[1].replace(/\\\n\s*/g, " ");
    for (const line of joined.split("\n")) if (line.trim().startsWith("curl")) out.push(line.trim());
  }
  return out;
}

function parseCurl(command) {
  const tokens = command.match(/"[^"]*"|'[^']*'|\S+/g).map((t) => t.replace(/^(["'])(.*)\1$/, "$2"));
  let method = "GET";
  const headers = {};
  let url;
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-X") method = tokens[++i];
    else if (t === "-H") {
      const [k, ...v] = tokens[++i].split(":");
      headers[k.trim().toLowerCase()] = v.join(":").trim();
    } else if (t === "-d") i++;
    else if (!t.startsWith("-")) url = t;
  }
  return { method, headers, url };
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "file starts with YAML front matter");
  const fields = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fields;
}

const read = (p) => readFile(join(ROOT, p), "utf8");
const readJson = async (p) => JSON.parse(await read(p));

describe("skills", () => {
  test("each skill has a folder-matching name and a real description", async () => {
    const dirs = (await readdir(join(ROOT, "skills"))).sort();
    assert.deepEqual(dirs, [...SKILLS].sort());
    for (const name of SKILLS) {
      const fm = frontmatter(await read(`skills/${name}/SKILL.md`));
      assert.equal(fm.name, name);
      assert.ok(fm.description.length > 40 && fm.description.length < 400, `${name} description length`);
    }
  });

  test("every curl example is a real route, authenticated, and idempotent where it must be", async () => {
    const api = fakeApi();
    let total = 0;
    for (const name of SKILLS) {
      for (const command of curlCommands(await read(`skills/${name}/SKILL.md`))) {
        const { method, headers, url } = parseCurl(command);
        assert.ok(url?.startsWith("https://api.sempera.org/"), `${name}: base URL in ${command}`);
        // The documented command, with the shell variable standing for the real key and uuidgen for a fresh key.
        const sent = { ...headers };
        if (sent.authorization) sent.authorization = sent.authorization.replace("$SEMPERA_API_KEY", "sempera_sk_test_0000");
        if (sent["idempotency-key"]) sent["idempotency-key"] = "key-1";
        const res = await api.fetch({ method, url: url.replace(/\$[A-Z_]+/g, "x-1"), headers: sent });
        assert.equal(res.status, 200, `${name}: ${command} -> ${res.status} ${res.reason ?? ""}`);
        total++;
      }
    }
    assert.ok(total >= 4, `found ${total} curl examples`);
  });

  test("every route written as METHOD /path in prose is in the public contract", async () => {
    for (const file of [...SKILLS.map((s) => `skills/${s}/SKILL.md`), "rules/sempera.mdc", "README.md"]) {
      const text = await read(file);
      for (const m of text.matchAll(/`(GET|POST|PATCH|PUT|DELETE) (\/v1\/[^`\s]*)`/g)) {
        assert.ok(match(m[1], m[2].replace(/\?.*$/, "")), `${file}: ${m[1]} ${m[2]} is not a known route`);
      }
    }
  });

  test("the send skill never defaults who is contacted", async () => {
    const text = await read("skills/sempera-send-call/SKILL.md");
    assert.match(text, /Never guess a number/);
    assert.match(text, /consent_basis/);
    assert.match(text, /explicit yes/);
    assert.match(text, /same idempotency key/i);
  });

  test("the publish and bind steps need the user's yes", async () => {
    assert.match(await read("skills/sempera-build-agent/SKILL.md"), /explicit yes/);
    assert.match(await read("skills/sempera-setup-phone-number/SKILL.md"), /explicit yes/);
  });

  test("the debug skill states the real signature scheme", async () => {
    const text = await read("skills/sempera-debug-call/SKILL.md");
    assert.match(text, /t=<unix seconds>,v1=<hex>/);
    assert.match(text, /"<t>\." \+ raw_body/);
  });

  test("the fake API itself refuses a missing key and a missing idempotency key", async () => {
    const api = fakeApi();
    assert.equal((await api.fetch({ method: "GET", url: "https://api.sempera.org/v1/me", headers: {} })).status, 401);
    assert.equal((await api.fetch({ method: "POST", url: "https://api.sempera.org/v1/calls", headers: { authorization: "Bearer k" } })).status, 400);
    assert.equal((await api.fetch({ method: "GET", url: "https://api.sempera.org/v1/nope", headers: { authorization: "Bearer k" } })).status, 404);
  });
});

describe("plugin manifests", () => {
  test("the manifest in .claude-plugin is complete and keeps the key out of the file", async () => {
    const m = await readJson(".claude-plugin/plugin.json");
    assert.equal(m.name, "sempera");
    assert.equal(m.license, "MIT");
    assert.equal(m.skills, "./skills");
    assert.equal(m.mcpServers, "./.mcp.json");
    assert.equal(m.userConfig.sempera_api_key.sensitive, true);
    assert.equal(m.userConfig.sempera_api_key.required, true);
    assert.doesNotMatch(JSON.stringify(m), /sempera_sk_/);
  });

  test("the Codex manifest points at the same skills and server", async () => {
    const m = await readJson(".codex-plugin/plugin.json");
    assert.equal(m.name, "sempera");
    assert.equal(m.skills, "./skills/");
    assert.equal(m.mcpServers, "./.mcp.json");
    assert.equal((await readJson(".claude-plugin/plugin.json")).version, m.version);
    assert.equal((await readJson("package.json")).version, m.version);
  });

  test("the bundled MCP server is @sempera/mcp, read-only, with the key from user config", async () => {
    const m = await readJson(".mcp.json");
    const s = m.mcpServers.sempera;
    assert.equal(s.command, "npx");
    assert.deepEqual(s.args, ["-y", "@sempera/mcp"]);
    assert.ok(!s.args.includes("--allow-writes"), "writes stay off by default");
    assert.equal(s.env.SEMPERA_API_KEY, "${user_config.sempera_api_key}");
    assert.equal(s.env.SEMPERA_MCP_ALLOW_WRITES, undefined);
  });

  test("package.json publishes the files the plugin needs", async () => {
    const pkg = await readJson("package.json");
    assert.equal(pkg.name, "@sempera/ai");
    assert.equal(pkg.license, "MIT");
    for (const f of [".claude-plugin", ".codex-plugin", ".mcp.json", "skills", "rules", "README.md"]) assert.ok(pkg.files.includes(f), f);
  });
});

describe("editor rules", () => {
  test("the Cursor rule has front matter and the safety rules", async () => {
    const text = await read("rules/sempera.mdc");
    const fm = frontmatter(text);
    assert.ok(fm.description);
    assert.equal(fm.alwaysApply, "false");
    assert.match(text, /Never default the recipient/);
    assert.match(text, /Idempotency-Key/);
    assert.match(text, /X-Sempera-Signature/);
  });
});

// Built from pieces so this file does not contain the words it forbids.
const EM_DASH = new RegExp(String.fromCharCode(0x2014));
const PRIVATE = new RegExp([["local", "host"].join(""), ["127", "0", "0", "1"].join("\\."), ["", "Users", ""].join("/")].join("|"));

describe("no secrets or private names", () => {
  test("no file holds a key, an em dash or a private host", async () => {
    const files = [];
    async function walk(dir) {
      for (const e of await readdir(join(ROOT, dir), { withFileTypes: true })) {
        if (e.name === "node_modules") continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else files.push(p);
      }
    }
    await walk(".");
    for (const f of files) {
      const text = await read(f);
      assert.doesNotMatch(text, /sempera_sk_[A-Za-z0-9]{8,}/, f);
      assert.doesNotMatch(text, EM_DASH, f);
      assert.doesNotMatch(text, PRIVATE, f);
    }
  });
});
