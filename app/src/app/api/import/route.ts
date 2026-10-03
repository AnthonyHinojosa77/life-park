import { connectedServices, importService, isImportService } from "@/lib/refresh";
import { getSession } from "@/lib/session";

// Reading a big calendar, mailbox, or set of repositories can take a while.
export const maxDuration = 60;

/** Pulls one connected service (a Google service, or GitHub) into the signed-in person's park. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { service?: unknown } | null;
  const service = typeof body?.service === "string" ? body.service : "";
  if (!isImportService(service)) return Response.json({ error: "Unknown service." }, { status: 400 });

  const connected = await connectedServices(session.user.id);
  if (!connected.includes(service)) {
    return Response.json({ error: "That service isn't connected yet." }, { status: 409 });
  }
  const result = await importService(session.user.id, service);
  return Response.json(result, { status: result.error ? 502 : 200 });
}
