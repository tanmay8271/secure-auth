import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { mongoUsers } from "./userModel.js";

const { MONGODB_URI, JWT_SECRET, PORT = 5000, CLIENT_ORIGIN } = process.env;
if (!MONGODB_URI || !JWT_SECRET) {
  console.error("Missing MONGODB_URI or JWT_SECRET. Copy .env.example to .env and fill them in.");
  process.exit(1);
}
await mongoose.connect(MONGODB_URI);
console.log("MongoDB connected");
createApp(mongoUsers, { secret: JWT_SECRET, origin: CLIENT_ORIGIN }).listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
