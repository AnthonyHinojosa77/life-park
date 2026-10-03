import { and, eq, notInArray } from "drizzle-orm";
import { db } from "../db";
import { githubInstallations, things } from "../db/app-schema";
import { deleteThingsFrom, recordConnection, upsertThings, type IncomingThing } from "../things";
import { GitHubAccessError, installationRepos } from "./app";

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** The installations someone has confirmed as theirs. */
export async function githubInstallationsOf(userId: string) {
  return db.select().from(githubInstallations).where(eq(githubInstallations.userId, userId));
}

/** Replaces someone's confirmed installations with the ones GitHub says they can reach. */
export async function saveInstallations(userId: string, list: { id: string; login: string }[]) {
  await db.delete(githubInstallations).where(eq(githubInstallations.userId, userId));
  if (list.length) {
    await db.insert(githubInstallations).values(list.map((i) => ({ userId, installationId: i.id, accountLogin: i.login })));
  }
}

/** One repository as a thing in the park. */
export function repoThing(r: Json): IncomingThing | null {
  const id = r.id !== undefined ? String(r.id) : undefined;
  const name = str(r.full_name) ?? str(r.name);
  if (!id || !name) return null;
  const pushed = str(r.pushed_at) ?? str(r.updated_at);
  const owner = (r.owner ?? {}) as Json;
  return {
    sourceId: id,
    kind: "repo",
    title: name,
    date: pushed ? new Date(pushed) : null,
    detail: {
      owner: str(owner.login) ?? null,
      description: str(r.description) ?? null,
      language: str(r.language) ?? null,
      private: r.private === true,
      archived: r.archived === true,
      fork: r.fork === true,
      stars: typeof r.stargazers_count === "number" ? r.stargazers_count : 0,
      link: str(r.html_url) ?? null,
    },
  };
}

/**
 * Pulls every repository from someone's GitHub installations into the park and
 * records how it went. Repositories no longer shared are removed. Never throws.
 */
export async function importGitHub(userId: string) {
  const service = "github";
  try {
    const installs = await githubInstallationsOf(userId);
    if (!installs.length) throw new GitHubAccessError("GitHub isn't connected.");
    const items: IncomingThing[] = [];
    let reached = 0;
    for (const install of installs) {
      try {
        for (const r of await installationRepos(install.installationId)) {
          const t = repoThing(r);
          if (t) items.push(t);
        }
        reached++;
      } catch (error) {
        // An installation removed on GitHub is forgotten here too.
        if (error instanceof GitHubAccessError) {
          await db
            .delete(githubInstallations)
            .where(and(eq(githubInstallations.userId, userId), eq(githubInstallations.installationId, install.installationId)));
        } else throw error;
      }
    }
    if (!reached) throw new GitHubAccessError("LifePark isn't installed on your GitHub anymore. Connect it again to bring your repositories back.");
    // What is no longer shared leaves the park; what is shared is brought up to date.
    const keep = items.map((t) => t.sourceId);
    await db
      .delete(things)
      .where(and(eq(things.userId, userId), eq(things.source, service), ...(keep.length ? [notInArray(things.sourceId, keep)] : [])));
    const count = await upsertThings(userId, service, items);
    await recordConnection(userId, service, { status: "connected", itemCount: count });
    return { service, count };
  } catch (error) {
    const message = error instanceof GitHubAccessError ? error.message : "Something went wrong reaching GitHub. Try again later.";
    if (!(error instanceof GitHubAccessError)) console.error("[import] github", error);
    await recordConnection(userId, service, { status: "error", lastError: message });
    return { service, count: 0, error: message };
  }
}

/** Disconnects GitHub: forgets the installations and takes the repositories out of the park. */
export async function disconnectGitHub(userId: string) {
  await db.delete(githubInstallations).where(eq(githubInstallations.userId, userId));
  await deleteThingsFrom(userId, "github");
  await recordConnection(userId, "github", { status: "error", lastError: "Disconnected." });
}
