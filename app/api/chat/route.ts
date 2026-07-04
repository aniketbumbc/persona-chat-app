import { NextRequest } from 'next/server';
import { OpenAI } from 'openai';
import { PersonaId } from '../../lib/prompt';
import { getSystemPrompt } from '../../lib/prompt';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { personaId, messages } = (await req.json()) as {
    personaId: PersonaId;
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  if (personaId !== 'hitesh' && personaId !== 'piyush') {
    return new Response(JSON.stringify({ error: 'Invalid personaId' }), {
      status: 400,
    });
  }

  let systemPrompt: string;
  try {
    systemPrompt = await getSystemPrompt(personaId);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-5-mini',
          stream: true,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        });

        for await (const chunk of completion) {
          const token = chunk.choices[0]?.delta?.content ?? '';
          if (token) {
            controller.enqueue(encoder.encode(token));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
