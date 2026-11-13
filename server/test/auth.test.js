import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";

const SECRET = "x".repeat(40);

function memoryUsers() {
  const rows = [];
  return {
    rows,
    findByEmail: async (e) => rows.find((r) => r.email === e) || null,
    findById: async (id) => rows.find((r) => r.id === id) || null,
    create: async (d) => {
      const u = { id: String(rows.length + 1), ...d };
      rows.push(u);
      return u;
    },
  };
}

async function start(opts = {}) {
  const users = memoryUsers();
  const server = createApp(users, { secret: SECRET, rounds: 4, ...opts }).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) =>
    fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const get = (path, headers = {}) => fetch(base + path, { headers });
  return { server, users, post, get };
}

const good = { name: "Asha", email: "Asha@Example.com", password: "correct horse 9" };

test("register stores a bcrypt hash, never the password, and returns a token", async () => {
  const { server, users, post } = await start();
  try {
    const r = await post("/api/auth/register", good);
    assert.equal(r.status, 201);
    const body = await r.json();
    assert.ok(body.token);
    assert.equal(body.user.email, "asha@example.com");
    assert.equal(body.user.passwordHash, undefined);
    assert.match(users.rows[0].passwordHash, /^\$2[aby]\$/);
    assert.notEqual(users.rows[0].passwordHash, good.password);
  } finally {
    server.close();
  }
});

test("weak input and duplicate emails are rejected", async () => {
  const { server, post } = await start();
  try {
    assert.equal((await post("/api/auth/register", { ...good, password: "short1" })).status, 400);
    assert.equal((await post("/api/auth/register", { ...good, password: "onlyletters" })).status, 400);
    assert.equal((await post("/api/auth/register", { ...good, password: "12345678" })).status, 400);
    assert.equal((await post("/api/auth/register", { ...good, email: "not-an-email" })).status, 400);
    assert.equal((await post("/api/auth/register", good)).status, 201);
    assert.equal((await post("/api/auth/register", { ...good, email: "asha@example.com" })).status, 409);
  } finally {
    server.close();
  }
});

test("login works, and wrong password and unknown email give the same answer", async () => {
  const { server, post } = await start();
  try {
    await post("/api/auth/register", good);
    assert.equal((await post("/api/auth/login", { email: "asha@example.com", password: good.password })).status, 200);
    const a = await post("/api/auth/login", { email: "asha@example.com", password: "wrong-password1" });
    const b = await post("/api/auth/login", { email: "nobody@example.com", password: "wrong-password1" });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.deepEqual(await a.json(), await b.json());
  } finally {
    server.close();
  }
});

test("protected route needs a valid token", async () => {
  const { server, post, get } = await start();
  try {
    const { token } = await (await post("/api/auth/register", good)).json();
    assert.equal((await get("/api/me")).status, 401);
    assert.equal((await get("/api/me", { authorization: "Bearer nonsense" })).status, 401);
    // signed with a different secret
    const forged = jwt.sign({ sub: "1" }, "y".repeat(40));
    assert.equal((await get("/api/me", { authorization: `Bearer ${forged}` })).status, 401);
    // expired
    const expired = jwt.sign({ sub: "1" }, SECRET, { expiresIn: -10 });
    assert.equal((await get("/api/me", { authorization: `Bearer ${expired}` })).status, 401);
    // "none" algorithm trick
    const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url") + "." + Buffer.from('{"sub":"1"}').toString("base64url") + ".";
    assert.equal((await get("/api/me", { authorization: `Bearer ${none}` })).status, 401);
    const r = await get("/api/me", { authorization: `Bearer ${token}` });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).user.name, "Asha");
  } finally {
    server.close();
  }
});

test("repeated attempts are rate limited", async () => {
  const { server, post } = await start({ limit: 3 });
  try {
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await post("/api/auth/login", { email: "a@b.co", password: "whatever1" })).status);
    assert.deepEqual(codes, [401, 401, 401, 429, 429]);
  } finally {
    server.close();
  }
});

test("refuses to start with a weak secret", () => {
  assert.throws(() => createApp(memoryUsers(), { secret: "short" }));
});
