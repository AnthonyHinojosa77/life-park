import { runNightlyRefresh } from "@/lib/refresh";

// Refreshing many parks can take a while; the job stops itself before this.
export const maxDuration = 60;

/**
 * Called by Vercel Cron every night (see vercel.json). When CRON_SECRET is set,
 * only calls carrying it are accepted. Without it the job still runs, since it
 * only refreshes what is overdue and reports nothing but counts.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runNightlyRefresh();
  return Response.json(result);
}
