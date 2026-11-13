// Registration, login and one protected route.
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  // 8+ characters, with a letter and a number. Max 72 because bcrypt ignores anything after 72 bytes.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters")
    .regex(/[A-Za-z]/, "Password needs a letter")
    .regex(/[0-9]/, "Password needs a number"),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72),
});

export function createApp(users, { secret, origin = "http://localhost:5173", rounds = 12, expiresIn = "1h", limit = 20 } = {}) {
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be set and at least 32 characters long");

  const app = express();
  app.use(helmet());
  app.use(cors({ origin }));
  app.use(express.json({ limit: "10kb" }));

  // Slows down password guessing: limit sign-in attempts per IP.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { error: "Too many attempts. Try again later." } });

  const check = (schema) => (req, res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return res.status(400).json({ error: r.error.issues[0].message });
    req.body = r.data;
    next();
  };
  const sign = (u) => jwt.sign({ sub: u.id }, secret, { expiresIn, algorithm: "HS256" });
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

  // Compared against when the email is unknown, so "no such user" takes as long as "wrong password".
  const dummyHash = bcrypt.hashSync("not-a-real-password", rounds);

  app.post("/api/auth/register", authLimiter, check(registerSchema), async (req, res) => {
    const { name, email, password } = req.body;
    if (await users.findByEmail(email)) return res.status(409).json({ error: "That email is already registered" });
    const user = await users.create({ name, email, passwordHash: await bcrypt.hash(password, rounds) });
    if (!user) return res.status(409).json({ error: "That email is already registered" });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  });

  app.post("/api/auth/login", authLimiter, check(loginSchema), async (req, res) => {
    const user = await users.findByEmail(req.body.email);
    const ok = await bcrypt.compare(req.body.password, user ? user.passwordHash : dummyHash);
    // One message for both cases, so the API never reveals which emails exist.
    if (!user || !ok) return res.status(401).json({ error: "Wrong email or password" });
    res.json({ token: sign(user), user: publicUser(user) });
  });

  // Middleware: lets a request through only with a valid, unexpired token.
  const requireAuth = async (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!m) return res.status(401).json({ error: "Login required" });
    try {
      const { sub } = jwt.verify(m[1], secret, { algorithms: ["HS256"] });
      const user = await users.findById(sub);
      if (!user) return res.status(401).json({ error: "Login required" });
      req.user = publicUser(user);
      next();
    } catch {
      res.status(401).json({ error: "Session expired. Please log in again." });
    }
  };

  app.get("/api/me", requireAuth, (req, res) => res.json({ user: req.user }));

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });
  return app;
}
