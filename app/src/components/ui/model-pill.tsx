import { ChevronDownIcon } from "./icons";
import { ChalkFill, chalk } from "./chalk";

type ModelPillProps = {
  name: string;
  /** Static for now. Becomes a menu when the model picker arrives. */
  onClick?: () => void;
};

/** Shows the model in use. A green dot means it is reachable. */
export function ModelPill({ name, onClick }: ModelPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative isolate inline-flex h-10 items-center gap-1.5 rounded-pill pr-3 pl-3.5 text-[13px] font-extrabold active:scale-[0.97]"
    >
      <ChalkFill color={chalk.paper} radius={12} />
      <span aria-hidden="true" className="size-2.5 rounded-full bg-grass" />
      {name}
      <ChevronDownIcon size={16} className="text-muted" />
    </button>
  );
}
