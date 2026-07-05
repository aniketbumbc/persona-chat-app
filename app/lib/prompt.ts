import { pool } from './db';

export type PersonaId = 'hitesh' | 'piyush';

let cache: Record<string, string> | null = null;
let cachedAt = 0;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

async function loadAllPrompts(): Promise<Record<string, string>> {
  const result = await pool.query('SELECT key, content FROM prompts');
  const map: Record<string, string> = {};
  for (const row of result.rows) {
    map[row.key] = row.content;
  }
  return map;
}

export async function getSystemPrompt(personaId: PersonaId): Promise<string> {
  const now = Date.now();
  if (!cache || now - cachedAt > TTL_MS) {
    cache = await loadAllPrompts();
    cachedAt = now;
  }

  const base = cache['SYSTEM_PROMPT'];
  const personaKey =
    personaId === 'hitesh' ? 'HITESH_SYSTEM_PROMPT' : 'PIYUSH_SYSTEM_PROMPT';
  const personaPrompt = cache[personaKey];

  if (!base || !personaPrompt) {
    throw new Error(`Missing prompt for personaId: ${personaId}`);
  }

  return `${base}\n\n${personaPrompt}`;
}
