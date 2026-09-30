import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { configuredProviders } from "@/lib/auth-providers";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getSession()) redirect("/chats");
  return (
    <AuthShell
      title="Welcome"
      footer={{ text: "New here?", linkText: "Create an account", href: "/sign-up" }}
    >
      <SignInForm mode="sign-in" providers={configuredProviders()} />
    </AuthShell>
  );
}
