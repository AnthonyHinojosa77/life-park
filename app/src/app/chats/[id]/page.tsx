import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChatView } from "@/components/chat/chat-view";
import { ConversationList } from "@/components/chat/conversation-list";
import { getConversation, getMessages, listConversations } from "@/lib/chat/store";
import { requireOnboarded } from "@/lib/session";

export const metadata: Metadata = { title: "Chat" };

const idShape = /^[a-zA-Z0-9-]{8,64}$/;

export default async function ChatPage({ params, searchParams }: PageProps<"/chats/[id]">) {
  const { id } = await params;
  const { prompt } = await searchParams;
  if (!idShape.test(id)) notFound();

  const { session, settings } = await requireOnboarded();
  const [conversation, threads] = await Promise.all([
    getConversation(session.user.id, id),
    listConversations(session.user.id),
  ]);
  const initialMessages = conversation ? await getMessages(id) : [];
  // The park's signs open a new chat with a starter sentence already typed.
  const initialInput = !conversation && typeof prompt === "string" ? prompt.slice(0, 300) : "";

  return (
    <AppShell active="chats" rail={<ConversationList conversations={threads} activeId={id} />}>
      <ChatView
        key={id}
        conversationId={id}
        initialMessages={initialMessages}
        isNew={!conversation}
        initialInput={initialInput}
        voice={settings.voice}
        speechifyAvailable={Boolean(process.env.SPEECHIFY_API_KEY)}
      />
    </AppShell>
  );
}
