import type { ReactNode } from "react";
import { ChatIcon, ParkIcon, SettingsIcon, WorkflowsIcon } from "./icons";
import { ChalkFill, ChalkOutline, chalk } from "./chalk";

export type NavKey = "chats" | "park" | "workflows" | "settings";

export const navItems: { key: NavKey; label: string; icon: ReactNode }[] = [
  { key: "chats", label: "Chats", icon: <ChatIcon size={22} /> },
  { key: "park", label: "Park", icon: <ParkIcon size={22} /> },
  { key: "workflows", label: "Workflows", icon: <WorkflowsIcon size={22} /> },
  { key: "settings", label: "Settings", icon: <SettingsIcon size={22} /> },
];

/** Phone: the bar along the bottom. The active item is colored in with green crayon. */
export function BottomNav({ active }: { active: NavKey }) {
  return (
    <nav
      aria-label="Main"
      className="flex justify-around border-t-2 border-ink bg-card px-3 pt-2 pb-6"
    >
      {navItems.map((item) => {
        const isActive = item.key === active;
        return (
          <a
            key={item.key}
            href={`/${item.key}`}
            aria-current={isActive ? "page" : undefined}
            className={`flex w-16 flex-col items-center gap-1 text-[11px] font-extrabold ${
              isActive ? "text-ink" : "text-muted"
            }`}
          >
            <span
              className={`relative isolate flex h-8 w-11 items-center justify-center rounded-xl ${
                isActive ? "text-white" : ""
              }`}
            >
              {isActive && <ChalkFill color={chalk.grass} radius={10} />}
              {item.icon}
            </span>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

/** Laptop: the list in the left rail. The active item gets a chalk outline. */
export function SideNav({ active }: { active: NavKey }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive = item.key === active;
        return (
          <a
            key={item.key}
            href={`/${item.key}`}
            aria-current={isActive ? "page" : undefined}
            className={`relative isolate flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm ${
              isActive ? "font-extrabold" : "font-bold text-muted hover:bg-card"
            }`}
          >
            {isActive && (
              <>
                <ChalkFill color={chalk.paper} radius={10} opacity={0.8} />
                <ChalkOutline radius={10} width={2} />
              </>
            )}
            {item.icon}
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
