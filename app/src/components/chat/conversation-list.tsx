import Link from "next/link";
import { ChalkFill, chalk } from "@/components/ui/chalk";
import type { Conversation } from "@/lib/chat/store";

type Props = {
  conversations: Conversation[];
  activeId?: string;
  /** Larger rows for the phone list page. */
  large?: boolean;
};

export function ConversationList({ conversations, activeId, large }: Props) {
  if (conversations.length === 0) {
    return (
      <p className="px-2 font-serif text-sm italic text-muted">
        No chats yet. Start one and it will show up here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {conversations.map((c) => {
        const active = c.id === activeId;
        return (
          <li key={c.id}>
            <Link
              href={`/chats/${c.id}`}
              aria-current={active ? "page" : undefined}
              className={`relative isolate block truncate rounded-xl px-3 ${large ? "py-3.5 text-[15px]" : "py-2 text-[13px]"} font-bold ${
                active ? "text-ink" : "text-ink-soft hover:bg-paper"
              } ${large ? "border-2 border-tan bg-card" : ""}`}
            >
              {active && <ChalkFill color={chalk.sun} radius={10} />}
              {c.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
