// @ts-nocheck Not using in production. This is for development purposes only.

import * as readline from 'readline';
import { Persona, PersonaId } from './constant/types';
import {
  HITESH_SYSTEM_PROMPT,
  PIYUSH_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
} from './utils/persona';
import { OpenAI } from 'openai';

const PERSONAS: Record<PersonaId, Persona> = {
  hitesh: {
    name: 'Hitesh',
    systemPrompt: HITESH_SYSTEM_PROMPT,
  },
  piyush: {
    name: 'Piyush',
    systemPrompt: PIYUSH_SYSTEM_PROMPT,
  },
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function callOpenAI(
  personaId: PersonaId,
  history: { role: 'user' | 'assistant'; content: string }[],
  onToken: (token: string) => void,
): Promise<string> {
  const persona = PERSONAS[personaId];

  const stream = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + persona.systemPrompt },
      ...history,
    ],
  });

  let content = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (!token) continue;
    content += token;
    onToken(token);
  }

  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  return content;
}

async function main() {
  console.log('Choose a persona: hitesh / piyush');
  const choice = (await ask('> ')).trim().toLowerCase() as PersonaId;

  if (!PERSONAS[choice]) {
    console.log('Invalid persona. Exiting.');
    rl.close();
    return;
  }

  console.log(
    `\nChatting with ${PERSONAS[choice].name}. Type "exit" to quit.\n`,
  );

  const history: { role: 'user' | 'assistant'; content: string }[] = [];

  while (true) {
    const userInput = (await ask('You: ')).trim();
    if (userInput.toLowerCase() === 'exit') break;
    if (!userInput) continue;

    history.push({ role: 'user', content: userInput });

    try {
      process.stdout.write(`\n${PERSONAS[choice].name}: `);
      const reply = await callOpenAI(choice, history, (token) => {
        process.stdout.write(token);
      });
      process.stdout.write('\n\n');
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      history.pop();
      console.error(
        '\nFailed to get a response:',
        err instanceof Error ? err.message : err,
        '\n',
      );
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  rl.close();
  process.exit(1);
});
