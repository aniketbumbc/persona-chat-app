"use client";

import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";

type PersonaId = "hitesh" | "piyush";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PERSONAS: Record<PersonaId, { label: string; initial: string; thinkingEmoji: string }> = {
  hitesh: { label: "Hitesh Sir", initial: "H", thinkingEmoji: "☕" },
  piyush: { label: "Piyush Sir", initial: "P", thinkingEmoji: "🔥" },
};

function ThinkingIndicator({ emoji }: { emoji: string }) {
  return (
    <span className="flex items-center gap-2 text-[#8a7d6f]">
      <span className="text-base animate-pulse">{emoji}</span>
      <span>Thinking</span>
      <span className="inline-flex gap-0.5 ml-0.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="animate-bounce font-bold"
            style={{ animationDelay: `${delay}ms` }}
          >
            .
          </span>
        ))}
      </span>
    </span>
  );
}

async function parseErrorResponse(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `Request failed (${res.status})`;
  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error ?? text;
  } catch {
    return text;
  }
}

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PersonaChat() {
  const [personaId, setPersonaId] = useState<PersonaId>("hitesh");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  function handleClearChat() {
    setMessages([]);
    setError(null);
  }

  async function handleCopy(content: string, index: number) {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      setError("Failed to copy to clipboard.");
    }
  }

  async function streamChat(
    apiMessages: Message[],
    options?: { rollbackMessages?: Message[]; restoreInput?: string },
  ) {
    const previousMessages = options?.rollbackMessages ?? messages;

    setError(null);
    setIsStreaming(true);
    setIsThinking(true);

    flushSync(() => {
      setMessages([...apiMessages, { role: "assistant", content: "" }]);
    });

    let gotFirstChunk = false;
    let assistantText = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, messages: apiMessages }),
      });

      if (!res.ok) {
        const errorMessage = await parseErrorResponse(res);
        setMessages(previousMessages);
        if (options?.restoreInput !== undefined) setInput(options.restoreInput);
        setError(errorMessage);
        return;
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!gotFirstChunk) {
          gotFirstChunk = true;
          setIsThinking(false);
        }
        assistantText += decoder.decode(value, { stream: true });
        flushSync(() => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantText,
            };
            return updated;
          });
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong. Try again.";

      if (!gotFirstChunk) {
        setMessages(previousMessages);
        if (options?.restoreInput !== undefined) setInput(options.restoreInput);
        setError(errorMessage);
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantText,
          };
          return updated;
        });
        setError(errorMessage);
      }
    } finally {
      setIsThinking(false);
      setIsStreaming(false);
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const previousMessages = messages;
    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setInput("");
    await streamChat(nextMessages, {
      rollbackMessages: previousMessages,
      restoreInput: trimmed,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="bg-[#100c09] flex items-center justify-center p-6 w-full">
      <div className="w-full max-w-6xl h-full rounded-2xl border border-[#2a221b] bg-[#150f0a] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a221b]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#3a2a1a] flex items-center justify-center text-xl">
              ☕
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-tight">Persona Chat</h1>
              <p className="text-[#8a7d6f] text-sm">Ask your mentor about technical or career related questions</p>
            </div>
          </div>
          <button
            onClick={handleClearChat}
            className="px-4 py-2 rounded-lg border border-[#3a2f26] text-[#c9bdb0] text-sm hover:bg-[#1f1712] transition-colors"
          >
            Clear chat
          </button>
        </div>

        {/* Persona selector */}
        <div className="flex gap-3 px-6 py-4">
          {(Object.keys(PERSONAS) as PersonaId[]).map((id) => {
            const persona = PERSONAS[id];
            const selected = personaId === id;
            return (
              <button
                key={id}
                onClick={() => {
                    setPersonaId(id);
                    setMessages([]);
                    setError(null);
                } }
                className={`flex-1 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  selected
                    ? "border-orange-500 bg-orange-500/5"
                    : "border-[#2a221b] hover:border-[#3a2f26]"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selected ? "border-orange-500" : "border-[#4a3f33]"
                  }`}
                >
                  {selected && <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                </span>
                <span className="w-7 h-7 rounded-full bg-[#3a2a1a] text-orange-400 text-sm font-bold flex items-center justify-center shrink-0">
                  {persona.initial}
                </span>
                <span className="text-[#e8ddd0] font-mono text-[15px]">{persona.label}</span>
              </button>
            );
          })}
        </div>

        {/* Message area */}
        <div ref={scrollRef} className="chat-scroll flex-1 min-h-[400px] max-h-[420px] overflow-y-auto border-t border-[#2a221b] px-6 py-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#3a2a1a] flex items-center justify-center text-2xl mb-4">
                ☕
              </div>
              <h2 className="text-white font-bold text-2xl mb-3">Namaste 👋</h2>
              <p className="text-[#8a7d6f] max-w-sm leading-relaxed">
                Pick a mentor above and type your question below. Ask about code, careers, or
                debugging — anything at all.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const avatar = isUser ? "U" : PERSONAS[personaId].initial;
                const isThinkingBubble =
                  !isUser && !msg.content && isThinking && i === messages.length - 1;
                const showActions =
                  msg.content && !isThinkingBubble && !isStreaming;

                return (
                  <div
                    key={i}
                    className={`group flex flex-col gap-1 max-w-[85%] ${
                      isUser ? "self-end items-end" : "self-start items-start"
                    }`}
                  >
                    <div
                      className={`flex items-end gap-2 ${
                        isUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold ${
                          isUser
                            ? "bg-orange-600 text-white"
                            : "bg-[#3a2a1a] text-orange-400"
                        }`}
                      >
                        {avatar}
                      </span>
                      <div
                        className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap font-mono ${
                          isUser
                            ? "bg-orange-500 text-white"
                            : "bg-[#1f1712] text-[#e8ddd0]"
                        }`}
                      >
                        {isThinkingBubble ? (
                          <ThinkingIndicator emoji={PERSONAS[personaId].thinkingEmoji} />
                        ) : (
                          <>
                            {msg.content}
                            {!isUser &&
                              isStreaming &&
                              !isThinking &&
                              i === messages.length - 1 && (
                                <span className="inline-block w-2 h-4 ml-0.5 bg-orange-400 animate-pulse align-middle" />
                              )}
                          </>
                        )}
                      </div>
                    </div>
                    {showActions && (
                      <div
                        className={`flex items-center gap-1 px-1 ${
                          isUser ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => void handleCopy(msg.content, i)}
                          title={copiedIndex === i ? "Copied!" : "Copy"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            copiedIndex === i
                              ? "text-green-400"
                              : isUser
                                ? "text-orange-300/70 hover:text-white hover:bg-orange-600/40"
                                : "text-[#8a7d6f] hover:text-[#e8ddd0] hover:bg-[#2a221b]"
                          }`}
                        >
                          {copiedIndex === i ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300 text-sm truncate">
            {error}
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-start gap-3 px-6 py-5 border-t border-[#2a221b]">
        <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${PERSONAS[personaId].label}...`}
            className="flex-1 bg-[#1a130d] border border-[#2a221b] rounded-xl px-5 py-4 text-[#e8ddd0] placeholder-[#6b5f52] font-mono text-[15px] focus:outline-none focus:border-orange-500/50 resize-none leading-normal"
        />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="w-12 h-12 shrink-0 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 flex items-center justify-center transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}