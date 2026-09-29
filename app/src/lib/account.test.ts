// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory";

const { db } = await import("./db");
const { runMigrations } = await import("./db/migrate");
const { auth } = await import("./auth");
const { saveSettings, defaultSettings, getSettings } = await import("./settings");
const { recordConnection, listConnections, listParkThings, saveChatThing } = await import("./things");
const { deleteAccount } = await import("./account");

describe("deleting an account", () => {
  beforeAll(async () => {
    await runMigrations(db);
  });

  it("removes the person and everything they had, and nobody else's", async () => {
    const make = async (email: string) => {
      const res = await auth.api.signUpEmail({
        body: { name: "Sam", email, password: "a-long-enough-password" },
        asResponse: true,
      });
      const body = (await res.json()) as { user: { id: string } };
      const id = body.user.id;
      await saveSettings(id, defaultSettings);
      await saveChatThing(id, { kind: "recipe", title: "Chili" });
      await recordConnection(id, "calendar", { status: "connected", itemCount: 1 });
      return { id, cookie: res.headers.get("set-cookie")! };
    };
    const gone = await make("gone@example.com");
    const kept = await make("kept@example.com");

    await deleteAccount(gone.id);

    expect(await getSettings(gone.id)).toBeNull();
    expect(await listParkThings(gone.id)).toEqual([]);
    expect(await listConnections(gone.id)).toEqual([]);
    expect(await auth.api.getSession({ headers: new Headers({ cookie: gone.cookie }) })).toBeNull();
    const signIn = await auth.api.signInEmail({
      body: { email: "gone@example.com", password: "a-long-enough-password" },
      asResponse: true,
    });
    expect(signIn.status).toBe(401);

    expect(await listParkThings(kept.id)).toHaveLength(1);
    expect((await auth.api.getSession({ headers: new Headers({ cookie: kept.cookie }) }))?.user.email).toBe("kept@example.com");

    // The same email can sign up again and starts from nothing.
    const again = await auth.api.signUpEmail({ body: { name: "Sam", email: "gone@example.com", password: "a-long-enough-password" } });
    expect(await getSettings(again.user.id)).toBeNull();
    expect(await listParkThings(again.user.id)).toEqual([]);
  });
});
