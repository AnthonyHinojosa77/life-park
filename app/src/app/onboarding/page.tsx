import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { requireSession } from "@/lib/session";
import { defaultSettings, getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const session = await requireSession();
  const existing = await getSettings(session.user.id);

  return (
    <OnboardingFlow
      name={session.user.name}
      initial={{
        favoriteModels: existing?.favoriteModels ?? defaultSettings.favoriteModels,
        navigation: existing?.navigation ?? defaultSettings.navigation,
        voice: existing?.voice ?? defaultSettings.voice,
        monthlyLimitCents: existing?.monthlyLimitCents ?? defaultSettings.monthlyLimitCents,
      }}
    />
  );
}
