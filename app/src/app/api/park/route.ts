import { getSession } from "@/lib/session";
import { listParkThings } from "@/lib/things";

/** Everything in the signed-in person's park, for redrawing it as things arrive. */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json({ things: await listParkThings(session.user.id) });
}
