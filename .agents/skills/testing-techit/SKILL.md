---
name: testing-techit-v2
description: Test the TechIT v2 inventory management app end-to-end. Use when verifying server-side API changes or client-side UI behavior.
---

# Testing TechIT v2

## Architecture

- **Server**: Express.js on port 3004 (configurable via PORT env var)
- **Client**: Next.js on port 3000
- **Database**: Supabase (PostgreSQL)
- **Email**: Nodemailer + Gmail SMTP
- **Auth**: JWT tokens stored in cookies

## Local Setup

### Server

```bash
cd server && npm install
```

Required env vars (create `server/.env` or export):
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase anon key
- `JWT_SECRET` — Must be at least 32 characters
- `EMAIL_USER` — Gmail address (optional, alerts skipped if missing)
- `EMAIL_PASS` — Gmail app password (optional)
- `LOW_STOCK_EMAIL` — Alert recipient (optional)

Start: `npm run dev` (uses nodemon) or `node index.js`

### Client

```bash
cd client && npm install
npm run dev
```

The client hardcodes `const API = 'https://techit-api.onrender.com'` in page files. For local testing against the local server, you'd need to temporarily change this or test with the remote API.

## Testing Strategies

### Server-side API Testing (shell-based)

Generate a JWT for testing:
```bash
cd server && node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { id: 'test-id', username: 'admin', role: 'admin' },
  process.env.JWT_SECRET || 'your_32_char_secret_here_for_testing',
  { expiresIn: '1h' }
);
console.log(token);
"
```

Then use curl:
```bash
curl -X GET http://localhost:3004/api/items \
  -H "Authorization: Bearer $TOKEN"

curl -X PUT http://localhost:3004/api/items/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","sku":"test","category":"test","quantity":5,"price":10}'
```

### Frontend Testing (browser-based)

To test the dashboard without a working backend login:
1. Open browser to `http://localhost:3000/login`
2. Set cookies via console:
```js
document.cookie = "token=<your_jwt>; path=/";
document.cookie = 'user=' + encodeURIComponent(JSON.stringify({id:"test",username:"admin",role:"admin"})) + '; path=/';
```
3. Navigate to `/dashboard`

To test corrupted cookie handling:
```js
document.cookie = "token=some_token; path=/";
document.cookie = "user=invalid_json{{{; path=/";
```
Then navigate to `/dashboard` — should redirect to `/login`.

## Deployment

- **Frontend**: Deployed on Vercel (preview deployments may be behind Vercel deployment protection)
- **Backend**: Deployed on Render at `https://techit-api.onrender.com`
- Render free tier may cold-start; the server might be slow on first request

## Known Constraints

- Vercel preview deployments might require Vercel account login (deployment protection)
- Without real Supabase credentials, server starts but all DB operations return errors
- The Render backend may run a different version than what's in the PR branch
- Email alerts are non-critical — the server gracefully skips them if EMAIL_USER/EMAIL_PASS are not configured

## Devin Secrets Needed

- `SUPABASE_URL` — for full end-to-end server testing
- `SUPABASE_KEY` — for full end-to-end server testing
- Vercel account credentials — only if testing preview deployments directly
