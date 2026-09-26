"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MicIcon, PaperclipIcon, SendIcon } from "@/components/ui/icons";
import { useReadAloud, type VoiceSource } from "@/lib/speech/use-read-aloud";
import { HandsFreeToggle, ListenButton } from "./read-aloud-controls";
import { ChalkFill, ChalkOutline, chalk } from "@/components/ui/chalk";

type Props = {
  conversationId: string;
  initialMessages: UIMessage[];
  isNew: boolean;
  voice: VoiceSource;
  speechifyAvailable: boolean;
};

export function ChatView({
  conversationId,
  initialMessages,
  isNew,
  voice,
  speechifyAvailable,
}: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const startedNew = useRef(false);
  const reader = useReadAloud({ voice, speechifyAvailable });
  const handsFreeRef = useRef(reader.handsFree);
  useEffect(() => {
    handsFreeRef.current = reader.handsFree;
  }, [reader.handsFree]);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      if (handsFreeRef.current && message.role === "assistant") {
        void reader.play(message.id, textOfParts(message.parts));
      }
      // A brand-new thread now exists on the server; refresh so the list shows it.
      if (isNew && !startedNew.current) {
        startedNew.current = true;
        router.refresh();
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text }, { body: { conversationId } });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end px-5 pb-2 md:pt-6">
        <HandsFreeToggle on={reader.handsFree} onChange={reader.setHandsFree} />
      </div>

      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-3">
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <p className="font-serif text-2xl">What&apos;s on your mind?</p>
            <p className="text-sm font-semibold text-muted">
              Tell me about a birthday, a plan, a recipe, or anything you want to remember.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            playing={reader.playingId === m.id}
            onListen={() =>
              reader.playingId === m.id ? reader.stop() : reader.play(m.id, textOfParts(m.parts))
            }
          />
        ))}
        {status === "submitted" && (
          <p className="font-serif text-sm italic text-muted">Thinking</p>
        )}
        {error && (
          <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-xs font-bold">
            {error.message}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="px-4 pt-2 pb-3 md:px-8 md:pb-6">
        <div className="relative isolate flex items-center gap-2 rounded-pill bg-card py-1 pr-1 pl-4 md:min-h-15 md:py-1.5 md:pr-1.5 md:pl-5">
          <ChalkOutline radius={28} />
          <PaperclipIcon className="shrink-0 text-muted" />
          <input
            type="text"
            aria-label="Message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent font-serif text-[17px] italic text-ink outline-none placeholder:text-placeholder"
          />
          <IconButton label="Speak" variant="ghost" className="size-10" type="button">
            <MicIcon className="text-muted" />
          </IconButton>
          {busy ? (
            <IconButton label="Stop" variant="stamp" type="button" onClick={() => stop()}>
              <span aria-hidden="true" className="size-3.5 rounded-sm bg-ink" />
            </IconButton>
          ) : (
            <IconButton
              label="Send"
              variant="press"
              type="submit"
              disabled={!input.trim()}
            >
              <SendIcon className="text-white" />
            </IconButton>
          )}
        </div>
      </form>
    </div>
  );
}

function textOfParts(parts: UIMessage["parts"]) {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

function MessageBubble({
  message,
  playing,
  onListen,
}: {
  message: UIMessage;
  playing: boolean;
  onListen: () => void;
}) {
  const text = textOfParts(message.parts);
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        {/* What you said: colored in with pale crayon, dark text for easy reading. */}
        <div className="relative isolate max-w-[85%] whitespace-pre-wrap px-4 py-3 text-[15px] font-semibold leading-relaxed text-ink md:max-w-[70%]">
          <ChalkFill color={chalk.paper} radius={8} />
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Card variant="stamp" className="flex max-w-[92%] flex-col gap-3 px-4 py-3.5 text-[15px] font-semibold leading-relaxed md:max-w-[80%]">
        <div className="whitespace-pre-wrap">{text || <span className="text-muted">…</span>}</div>
        {text && (
          <div>
            <ListenButton playing={playing} onClick={onListen} />
          </div>
        )}
      </Card>
    </div>
  );
}
