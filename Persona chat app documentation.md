# Persona Chat App — Documentation

An AI-powered chat app simulating conversations with two tech educators — **Hitesh Choudhary** and **Piyush Garg** (Chai aur Code) — built with Next.js, Neon Postgres, and OpenAI streaming.

---

## 1. Persona Data Collection & Preparation

Personas were built from **real, unscripted live-stream transcripts** (two per person) rather than secondhand bios — live streams expose genuine filler words, code-switching habits, and recurring opinions that scripted content smooths over.

For each transcript, we extracted:

- **Speech patterns** — signature openers/closers/fillers (Hitesh: "dekho yaar," "that is it"; Piyush: "that's more important," "right?")
- **Code-switching style** — _how_ Hindi/English blend differs per person, not just _that_ they blend
- **Recurring genuine opinions** — real stances repeated across transcripts (Hitesh's "why convince anyone" individualism; Piyush's "AI eroded muscle memory" view), prioritized over generic advice
- **Distinctive quirks** — traits that differentiate from a generic persona (Piyush's tech-to-Hindu-cosmology analogies; Hitesh's habit of flipping questions back at the asker)
- **Stated biographical facts** — used only where actually said on stream, never assumed

Each persona is a real, named public figure, so every prompt explicitly frames output as _"an AI persona inspired by their style,"_ never a claim to be the real person.

---

## 2. Prompt Engineering Strategy

Each persona prompt has two layers, combined at request time:

```
SYSTEM_PROMPT (shared, persona-agnostic)  +  HITESH/PIYUSH_SYSTEM_PROMPT (persona-specific)
```

The shared layer sets universal rules (AI-persona disclosure, non-fabrication). Each persona-specific layer splits into:

- **VOICE** — sentence patterns, fillers, rhetorical habits
- **CONTENT STANCE** — real opinions/defaults, plus explicit "don't" boundaries (e.g. don't turn every reply into a tangent, don't invent unverifiable facts)

**Why this structure:** separating voice from content lets each be tuned independently. Explicit negative constraints were added after noticing a purely positive-trait prompt over-applies a trait to every response (e.g. Piyush philosophizing constantly) — frequency guidance ("occasionally, not every message") fixed this.

**Few-shot examples** (real, transcript-grounded Q&A pairs) were included alongside instructions — a concrete example of blunt phrasing anchors tone far more reliably than the adjective "blunt" alone.

**Iteration:** personas were revised after each additional transcript, adding newly confirmed traits as reinforcing evidence rather than starting over.

---

## 3. Context Management Approach

**Conversation history:** the frontend keeps full `{role, content}[]` history in state and resends it every request (Chat Completions API is stateless).

**Persona isolation:** switching personas clears history (`setMessages([])`) so the new persona never responds to context it was never actually told in its own voice.

**Prompt storage & caching:** prompts live in a Neon Postgres `prompts` table (editable without redeploying), cached in-memory with a 10-minute TTL — avoids a DB round-trip per message while still picking up edits without a restart. Chose in-memory over Redis: at this scale (2 personas, low volume), an external cache adds operational overhead without real benefit.

**Streaming:** the API route parses OpenAI's SSE stream server-side and re-emits plain text chunks; the frontend reads incrementally for a live "typing" effect.

---

## 4. Sample Conversations

_Illustrative outputs based on each persona's prompt design, in the Roman-script Hinglish the app actually produces._

### Same question, both personas

**User:** "Should I focus on DSA or just start building projects?"

**Hitesh:** "Dekho yaar, aisa nahi hai ki ek sahi hai, ek galat hai. Both matter — DSA helps your problem-solving thought process, projects teach you how software actually ships. Thoda dono saath mein karo, LeetCode ko blindly grind mat karo. Agar koi kahe sirf ek karo, that is it, wo galat advice hai. You do you."

**Piyush:** "Yaar, this is actually interesting. Right? DSA isn't something you 'subjectify' — it builds your thought process. But that's more important — can you actually ship a full product end to end? Do you _really_ know why something is O(n), or just that it works? Both, but lean into whichever one you're avoiding."

_(Same question, different structure: Hitesh resolves quickly with a blunt close; Piyush turns it into a longer reflective monologue with his signature rhetorical device.)_

### Signature trait triggered

**User (to Piyush):** "Explain how Kubernetes pods work"

> "...there's a control plane that assigns pods to nodes and watches them. Right? And if you think about it, that's basically a controller in Hindu cosmology — overseeing everything without doing the work itself. Anyway, that's more important than getting lost in that: practically, if a pod dies, Kubernetes reschedules it based on what the control plane observes."

**User (to Hitesh):** "Explain how Kubernetes pods work"

> "Basically ek pod hai smallest deployable unit. Kubernetes usko node pe schedule karta hai, aur crash ho jaaye toh restart bhi karwa deta hai. That is it, zyada theory mein mat jao — jaake ek deployment YAML likho, phir samajh aayega."

_(Same technical question, one produces a philosophical detour, the other a direct hands-on answer.)_

### Guardrail check

**User:** "Are you actually Hitesh Choudhary?"
**Hitesh (persona):** "Nahi yaar, main ek AI persona hoon jo unki speaking style se inspired hoke banaya gaya hai, ek educational project ke liye. Asli Hitesh sir ka content unke YouTube channel pe milega."

Confirms correct self-identification as an AI simulation, per the shared `SYSTEM_PROMPT` constraint.

---

## Tech Stack

Next.js (App Router) + TypeScript + Tailwind · Neon Postgres · OpenAI streaming · In-memory TTL cache · Vercel
