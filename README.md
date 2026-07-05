# Persona Chat App

A Next.js chat application where users talk to AI mentors with distinct personas (**Hitesh** and **Piyush**). System prompts are stored in PostgreSQL, merged per persona on the server, and responses stream from OpenAI in real time.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Environment Setup](#environment-setup)
5. [Database Setup](#database-setup)
6. [Installation & Execution](#installation--execution)
7. [Step-by-Step Implementation](#step-by-step-implementation)
8. [Request Flow](#request-flow)
9. [API Reference](#api-reference)
10. [Error Handling](#error-handling)
11. [Prompt Caching](#prompt-caching)
12. [Scripts](#scripts)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| AI | OpenAI API (`gpt-5-mini`, streaming) |
| Database | PostgreSQL via `pg` (e.g. Neon) |
| Language | TypeScript |

---

## Project Structure

```
persona-chat-app/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # Chat endpoint — OpenAI streaming
│   │   └── prompts/route.ts    # Dev-only: list prompts from DB
│   ├── components/
│   │   └── PersonaChat.tsx     # Main chat UI
│   ├── lib/
│   │   ├── db.ts               # PostgreSQL connection pool
│   │   └── prompt.ts           # Load & cache prompts from DB
│   ├── page.tsx                # Home page
│   ├── layout.tsx
│   └── globals.css
├── server-cmd.ts               # Optional CLI chat (dev only)
├── .env                        # Secrets (not committed)
└── package.json
```

---

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm** (or yarn / pnpm)
- **OpenAI API key** — [platform.openai.com](https://platform.openai.com)
- **PostgreSQL database** — e.g. [Neon](https://neon.tech), Supabase, or local Postgres

---

## Environment Setup

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `DATABASE_URL` | PostgreSQL connection string |

> **Never commit `.env` to git.** Add it to `.gitignore` if it is not already there.

---

## Database Setup

### 1. Create the `prompts` table

Run this SQL in your PostgreSQL database:

```sql
CREATE TABLE IF NOT EXISTS prompts (
  key     TEXT PRIMARY KEY,
  name    TEXT,
  content TEXT NOT NULL
);
```

### 2. Seed required prompts

The app expects exactly three prompt keys:

| `key` | Purpose |
|-------|---------|
| `SYSTEM_PROMPT` | Base instructions shared by all personas |
| `HITESH_SYSTEM_PROMPT` | Hitesh-specific personality & style |
| `PIYUSH_SYSTEM_PROMPT` | Piyush-specific personality & style |

Example seed (replace content with your own):

```sql
INSERT INTO prompts (key, name, content) VALUES
  ('SYSTEM_PROMPT', 'Base System Prompt', 'You are a helpful coding mentor...'),
  ('HITESH_SYSTEM_PROMPT', 'Hitesh Persona', 'You speak like Hitesh. Use a warm, practical tone...'),
  ('PIYUSH_SYSTEM_PROMPT', 'Piyush Persona', 'You speak like Piyush. Be encouraging and clear...')
ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content;
```

### 3. Verify

```bash
# Optional — hit the dev prompts endpoint after starting the server
curl http://localhost:3000/api/prompts
```

---

## Installation & Execution

### Step 1 — Clone and install

```bash
git clone <your-repo-url>
cd persona-chat-app
npm install
```

### Step 2 — Configure environment

Create `.env` with `OPENAI_API_KEY` and `DATABASE_URL` (see [Environment Setup](#environment-setup)).

### Step 3 — Set up the database

Run the SQL from [Database Setup](#database-setup) in your Postgres instance.

### Step 4 — Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Step 5 — Use the app

1. Pick a mentor: **Hitesh Sir** or **Piyush Sir**
2. Type a question in the input box
3. Press **Enter** or click the send button
4. Watch the streamed response appear token by token

### Production build

```bash
npm run build
npm start
```

---

## Step-by-Step Implementation

This section describes how the app was built, layer by layer.

### Step 1 — Database connection (`app/lib/db.ts`)

- Creates a shared `pg` connection pool using `DATABASE_URL`
- Reuses the pool in development via `globalThis` to avoid connection leaks during hot reload

### Step 2 — Prompt loading (`app/lib/prompt.ts`)

- Queries all rows from the `prompts` table
- Merges `SYSTEM_PROMPT` + persona prompt (`HITESH_SYSTEM_PROMPT` or `PIYUSH_SYSTEM_PROMPT`)
- Returns a single system string: `base + "\n\n" + persona`
- Caches prompts in memory for **30 minutes** to reduce DB load

### Step 3 — Chat API (`app/api/chat/route.ts`)

1. Accepts `POST` with `{ personaId, messages }`
2. Validates `personaId` is `"hitesh"` or `"piyush"`
3. Loads merged system prompt via `getSystemPrompt(personaId)`
4. Calls OpenAI **before** starting the stream (so errors return proper HTTP status codes)
5. On success, streams tokens back as plain text (`text/plain`)
6. On failure, returns JSON `{ error: "message" }` with status 400 / 500 / 502

OpenAI request shape:

```ts
messages: [
  { role: 'system', content: systemPrompt },
  ...messages  // full chat history from client
]
```

### Step 4 — Chat UI (`app/components/PersonaChat.tsx`)

- Persona selector (Hitesh / Piyush) — switching clears chat
- Message list with user and assistant bubbles
- Streaming display with a typing cursor
- "Thinking" indicator while waiting for the first token
- Optimistic UI: shows user message immediately, then streams assistant reply
- Error banner above the input on server/network failures
- On pre-stream errors: rolls back the user message and restores input text

### Step 5 — Home page (`app/page.tsx`)

- Renders the `PersonaChat` component full-screen

### Step 6 — Dev prompts API (`app/api/prompts/route.ts`)

- `GET /api/prompts` — returns all prompts from the database
- For development/debugging only; the chat UI does not use this endpoint

---

## Request Flow

```
User types message
       │
       ▼
PersonaChat.tsx
  • Adds user message to local state
  • POST /api/chat { personaId, messages }
       │
       ▼
app/api/chat/route.ts
  • Validate personaId
  • getSystemPrompt(personaId)  →  DB (cached 30 min)
  • openai.chat.completions.create (stream)
  • Pipe tokens → HTTP response stream
       │
       ▼
PersonaChat.tsx
  • Reads stream chunk by chunk
  • Updates assistant bubble in real time
```

### What is sent on each request

| Direction | Payload |
|-----------|---------|
| Client → Server | `{ personaId: "hitesh" \| "piyush", messages: [...] }` |
| Server → OpenAI | `[{ role: "system", content: "..." }, ...history]` |
| Server → Client | Streamed plain text tokens |

Conversation history lives in **browser state only** — there is no server-side session or database storage of chats.

---

## API Reference

### `POST /api/chat`

**Request body:**

```json
{
  "personaId": "hitesh",
  "messages": [
    { "role": "user", "content": "How do I use useEffect?" },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "Can you show an example?" }
  ]
}
```

**Success:** `200` — `text/plain` streamed body

**Errors:** JSON `{ "error": "..." }`

| Status | Cause |
|--------|-------|
| `400` | Invalid `personaId` |
| `500` | Database or missing prompt |
| `401` / `429` / `502` | OpenAI API error |

### `GET /api/prompts` (dev only)

**Success:**

```json
{
  "prompts": [
    { "key": "SYSTEM_PROMPT", "name": "...", "content": "..." }
  ]
}
```

---

## Error Handling

### Server (`app/api/chat/route.ts`)

- Validation and DB errors → JSON response with correct status **before** streaming
- OpenAI errors on `create()` → caught and returned as JSON (not a misleading `200` stream)
- Mid-stream failures → logged as `Stream error` in the server console

### Client (`app/components/PersonaChat.tsx`)

| Error type | UI behavior |
|------------|-------------|
| Server error before stream (`!res.ok`) | User message removed, input restored, red error banner |
| Network / stream error (no tokens yet) | Same rollback + banner |
| Stream error after tokens started | Partial response kept, error shown in banner |

---

## Prompt Caching

Defined in `app/lib/prompt.ts`:

- Prompts are loaded from PostgreSQL and stored in an in-memory cache
- Cache TTL: **30 minutes**
- After TTL expires, the next chat request refreshes from the database
- Both personas share the same cache (only the persona key selection differs)

To see prompt changes immediately during development, restart the dev server or wait for the TTL to expire.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run lint` | Run ESLint |

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| `OPENAI_API_KEY is not set` | `.env` exists and key is set; restart dev server |
| `Missing prompt for personaId` | All three prompt keys exist in the `prompts` table |
| Database connection error | `DATABASE_URL` is correct; DB is reachable |
| `401` from OpenAI | API key is valid and has credits |
| `429` from OpenAI | Rate limit — wait and retry |
| Error banner shows raw JSON | Server should return `{ "error": "..." }`; client parses this automatically |

---

## License

Private project.
