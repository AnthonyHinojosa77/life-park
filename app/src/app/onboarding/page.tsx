import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { configuredProviders } from "@/lib/auth-providers";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const session = await requireSession();
  const google = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, "google")))
    .limit(1);

  return (
    <OnboardingFlow
      name={session.user.name}
      googleAvailable={configuredProviders().includes("google")}
      hasGoogle={google.length > 0}
    />
  );
}
