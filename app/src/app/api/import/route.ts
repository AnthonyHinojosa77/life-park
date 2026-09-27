import { googleGrants, importGoogleService } from "@/lib/google/import";
import { isGoogleService } from "@/lib/google/services";
import { getSession } from "@/lib/session";

// Reading a big calendar or mailbox can take a while.
export const maxDuration = 60;

/** Pulls one connected Google service into the signed-in person's park. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { service?: unknown } | null;
  const service = typeof body?.service === "string" ? body.service : "";
  if (!isGoogleService(service)) return Response.json({ error: "Unknown service." }, { status: 400 });

  const grants = await googleGrants(session.user.id);
  if (!grants?.includes(service)) {
    return Response.json({ error: "That service isn't connected yet." }, { status: 409 });
  }
  const result = await importGoogleService(session.user.id, service);
  return Response.json(result, { status: result.error ? 502 : 200 });
}
