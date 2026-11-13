# Secure Authentication System

Register, log in and open a page that only logged-in users can see. Passwords are hashed and sessions use JWT.

**Stack:** React 18 (Vite, React Router), Node.js, Express, MongoDB (Mongoose), JWT (jsonwebtoken), bcrypt (bcryptjs), Zod, Helmet.

## What it does
- **Register:** name, email, password. Password must be 8 to 72 characters with a letter and a number.
- **Log in:** returns a signed JWT that expires after 1 hour.
- **Protected route:** `GET /api/me` and the `/dashboard` page need a valid token. Visitors without one go to the login page.
- **Log out** clears the token.

## Security choices
- Passwords are hashed with bcrypt (cost 12) and stored as a hash. The password itself is never stored or returned.
- Wrong password and unknown email give the same message, and the same amount of work, so the API does not reveal which emails exist.
- JWTs are signed with `JWT_SECRET` (the server refuses to start if it is missing or under 32 characters). Only HS256 is accepted, so the "none algorithm" trick fails. Expired and forged tokens are rejected.
- Rate limit on register and login: 20 attempts per 15 minutes per IP.
- Helmet security headers, CORS limited to your client address, a 10 KB body limit, Zod validation on every input.
- Unexpected errors return a generic message. No stack traces leave the server.
- The token is kept in `sessionStorage` (gone when the tab closes). Trade-off: a script injected into the page could read it. A stricter design uses an httpOnly cookie. This is a good next step.

`bcryptjs` is the pure JavaScript version of bcrypt. It makes the same hashes and avoids native files that Windows can block.

## Run it on Windows (VS Code terminal)
You need Node 20+ and a MongoDB database (local, or a free Atlas cluster).

**1. API** (first terminal)
```
cd server
npm install
copy .env.example .env
```
Open `server/.env`. Set `MONGODB_URI`. Set `JWT_SECRET` to a long random string. Make one with:
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Then:
```
npm run dev
```

**2. Client** (second terminal)
```
cd client
npm install
npm run dev
```
Open http://localhost:5173.

## Tests
```
cd server
npm test
```
Six tests cover: hashing, validation, duplicate emails, identical login errors, forged / expired / "none" tokens, rate limiting, and the secret check. They use an in-memory stand-in for the database.

## API
| Method | Path | Body | Result |
|---|---|---|---|
| POST | /api/auth/register | name, email, password | 201 `{ token, user }` |
| POST | /api/auth/login | email, password | 200 `{ token, user }` |
| GET | /api/me | header `Authorization: Bearer <token>` | 200 `{ user }` |

## Deploy
Client on Hostinger (`npm run build`, upload `client/dist`, set `VITE_API_URL` first). API on Render. Database on MongoDB Atlas. Set `CLIENT_ORIGIN` and `JWT_SECRET` on the API host. For React Router on Hostinger, add a rewrite so unknown paths load `index.html`.

## Honest note
Routes and the browser flow were tested here with an in-memory database. The Mongoose code in `userModel.js` has not been run against a live MongoDB yet. Run it once on your machine and tell me if anything fails.
