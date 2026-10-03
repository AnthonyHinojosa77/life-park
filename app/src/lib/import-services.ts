import { googleServices, isGoogleService, type GoogleServiceId } from "./google/services";
import type { ThingKind } from "./kinds";

/**
 * Everything the park can bring in from a connected account: each Google
 * service, and GitHub. Kept free of server code so screens can use it too.
 */
export type ImportService = GoogleServiceId | "github";

export const isImportService = (s: string): s is ImportService => s === "github" || isGoogleService(s);

export const serviceName = (id: ImportService) => (id === "github" ? "GitHub" : (googleServices.find((s) => s.id === id)?.label ?? id));

/** The lawn each service fills. */
export const lawnFor: Record<ImportService, ThingKind> = {
  calendar: "event",
  contacts: "person",
  tasks: "list",
  gmail: "mail",
  drive: "file",
  docs: "file",
  sheets: "file",
  github: "repo",
};
