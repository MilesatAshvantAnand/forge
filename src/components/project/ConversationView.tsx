"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { Send, Flame, FileCode, Globe, Loader2 } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { VoiceButton } from "@/components/copilot/VoiceButton";
import { ListenButton } from "@/components/copilot/ListenButton";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Explain this robot's architecture",
  "Why does my robot overshoot turns?",
  "Where is odometry implemented?",
  "Walk me through the autonomous routines",
  "Find every PID controller and its gains",
  "What should we document before competition?",
];

interface ConversationViewProps {
  projectId: string;
  projectName: string;
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onSelectFile: (path: string) => void;
  onTitleChanged: () => void;
  suggestedPrompts?: string[];
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  highlightedPrompt?: string | null;
  cannedResponses?: Record<string, string>;
  onDemoMessageSent?: (prompt: string) => boolean;
  buildLogRecording?: boolean;
  onBuildLogEntry?: (user: string, assistant?: string) => void;
  pendingPrompt?: string | null;
  onPendingPromptConsumed?: () => void;
}

export function ConversationView({
  projectId,
  projectName,
  conversationId,
  onConversationCreated,
  onSelectFile,
  onTitleChanged,
  suggestedPrompts,
  welcomeTitle,
  welcomeSubtitle,
  highlightedPrompt,
  cannedResponses,
  onDemoMessageSent,
  buildLogRecording,
  onBuildLogEntry,
  pendingPrompt,
  onPendingPromptConsumed,
}: ConversationViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Conversations created locally mid-send must not trigger a refetch,
  // or the optimistic messages would be wiped while streaming
  const locallyCreatedRef = useRef<string | null>(null);

  // Reset messages synchronously when switching to a new (empty) conversation
  const [lastCid, setLastCid] = useState(conversationId);
  if (lastCid !== conversationId) {
    setLastCid(conversationId);
    if (conversationId === null) setMessages([]);
  }

  useEffect(() => {
    if (!conversationId || locallyCreatedRef.current === conversationId) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/conversations/${conversationId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMessages(d.messages ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (pendingPrompt && !streaming) {
      send(pendingPrompt);
      onPendingPromptConsumed?.();
    }
  }, [pendingPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streaming) return;

      setInput("");
      setStreaming(true);

      // Demo canned responses — no API call needed for judges
      if (cannedResponses) {
        const key = Object.keys(cannedResponses).find((k) =>
          content.toLowerCase().includes(k)
        );
        if (key) {
          const response = cannedResponses[key];
          const userMsg: ChatMessage = {
            id: `u-${Date.now()}`,
            role: "user",
            content,
            createdAt: Date.now(),
          };
          const assistantId = `a-${Date.now()}`;
          setMessages((prev) => [
            ...prev,
            userMsg,
            { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
          ]);

          // Typewriter effect for demo polish
          let i = 0;
          const chunk = 12;
          const timer = setInterval(() => {
            i += chunk;
            const slice = response.slice(0, i);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: slice } : m
              )
            );
            if (i >= response.length) {
              clearInterval(timer);
              setStreaming(false);
              onDemoMessageSent?.(content);
              onBuildLogEntry?.(content, response);
            }
          }, 16);
          return;
        }
      }

      // Lazily create the conversation on first message
      let cid = conversationId;
      if (!cid) {
        try {
          const res = await fetch(`/api/projects/${projectId}/conversations`, {
            method: "POST",
          });
          const d = await res.json();
          cid = d.conversation.id as string;
          locallyCreatedRef.current = cid;
          onConversationCreated(cid);
        } catch {
          setStreaming(false);
          return;
        }
      }

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content,
        createdAt: Date.now(),
      };
      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          citations: [],
          createdAt: Date.now(),
        },
      ]);

      try {
        const res = await fetch(
          `/api/projects/${projectId}/conversations/${cid}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: content }),
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Request failed");
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            if (!event.startsWith("data: ")) continue;
            const payload = JSON.parse(event.slice(6));
            if (payload.type === "token") {
              assistantContent += payload.token;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + payload.token }
                    : m
                )
              );
            } else if (payload.type === "citations") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, citations: payload.citations } : m
                )
              );
            } else if (payload.type === "error") {
              throw new Error(payload.error);
            }
          }
        }
        onTitleChanged();
        if (buildLogRecording) {
          onBuildLogEntry?.(content, assistantContent);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content || `⚠️ ${msg}` } : m
          )
        );
      } finally {
        setStreaming(false);
      }
    },
    [projectId, conversationId, streaming, onConversationCreated, onTitleChanged, cannedResponses, onDemoMessageSent, buildLogRecording, onBuildLogEntry]
  );

  const prompts = suggestedPrompts ?? SUGGESTED_PROMPTS;
  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-dim)]"
            >
              <Flame className="h-6 w-6 text-[var(--accent)]" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-5 text-xl font-semibold tracking-tight"
            >
              {welcomeTitle ?? "What are we working on?"}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.16 }}
              className="mt-2 max-w-md text-center text-sm leading-relaxed text-[var(--muted)]"
            >
              {welcomeSubtitle ??
                `I already know ${projectName} — its subsystems, constants, PID controllers, and autonomous routines. Ask me anything about it.`}
            </motion.p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} onSelectFile={onSelectFile} />
            ))}
            {streaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Reading project context...
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-6 pb-6">
        <div className="mx-auto max-w-2xl">
          {isEmpty && (
            <div className="mb-3 flex flex-wrap justify-center gap-1.5">
              {prompts.map((p) => {
                const isHighlighted =
                  highlightedPrompt &&
                  p.toLowerCase().includes(highlightedPrompt.toLowerCase());
                return (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      isHighlighted
                        ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="glass flex items-end gap-2 rounded-2xl p-2.5 focus-within:border-[var(--border-strong)]"
          >
            <VoiceButton onTranscript={(t) => setInput(t)} disabled={streaming} />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = textareaRef.current;
                if (el) {
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={`Ask about ${projectName}...`}
              className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-[var(--muted)]"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-black transition-opacity",
                (streaming || !input.trim()) && "opacity-40"
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-[var(--muted)]/60">
            Forge is grounded in your project context — it cites files and states
            confidence, but always verify on the robot.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  onSelectFile,
}: {
  message: ChatMessage;
  onSelectFile: (path: string) => void;
}) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[var(--accent-dim)] px-4 py-2.5 text-sm leading-relaxed"
      >
        {message.content}
      </motion.div>
    );
  }

  const projectCitations = (message.citations ?? []).filter(
    (c) => c.source === "project"
  );
  const webCitations = (message.citations ?? []).filter((c) => c.source === "web");
  const uniqueFiles = [...new Map(projectCitations.map((c) => [c.file, c])).values()];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-dim)]">
          <Flame className="h-3 w-3 text-[var(--accent)]" />
        </div>
        <span className="text-xs font-medium text-[var(--muted)]">Forge</span>
      </div>

      {(uniqueFiles.length > 0 || webCitations.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {uniqueFiles.slice(0, 5).map((c) => (
            <button
              key={c.file}
              onClick={() =>
                !c.file.startsWith("resources/") && onSelectFile(c.file)
              }
              title={c.file}
              className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent)] transition-colors hover:border-[var(--accent)]"
            >
              <FileCode className="h-2.5 w-2.5" />
              {c.file.replace("resources/", "").split("/").pop()}
            </button>
          ))}
          {webCitations.slice(0, 2).map((c) => (
            <button
              key={c.url}
              onClick={() => c.url && window.open(c.url, "_blank")}
              title={c.url}
              className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--blue,#38bdf8)] transition-colors hover:border-[var(--blue,#38bdf8)]"
            >
              <Globe className="h-2.5 w-2.5" />
              {(c.title ?? "Web source").slice(0, 30)}
            </button>
          ))}
        </div>
      )}

      <div className="prose-chat mt-2" style={{ fontSize: "0.875rem" }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ children, ...props }) {
              const text = String(children);
              const isPath = /^[\w\-./]+\.(cpp|hpp|c|h|java|py|md|json)$/.test(text);
              if (isPath) {
                return (
                  <button
                    onClick={() => onSelectFile(text.replace(/^\.?\//, ""))}
                    className="cursor-pointer underline decoration-dotted underline-offset-2"
                  >
                    <code {...props}>{text}</code>
                  </button>
                );
              }
              return <code {...props}>{children}</code>;
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {message.content && (
        <div className="mt-1.5">
          <ListenButton text={message.content} />
        </div>
      )}
    </motion.div>
  );
}
