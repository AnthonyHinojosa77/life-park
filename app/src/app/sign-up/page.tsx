import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { configuredProviders, signInErrorMessage } from "@/lib/auth-providers";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  if (await getSession()) redirect("/chats");
  const { error } = await searchParams;
  return (
    <AuthShell
      title="Plant your park"
      footer={{ text: "Already have an account?", linkText: "Sign in", href: "/sign-in" }}
    >
      <SignInForm
        mode="sign-up"
        providers={configuredProviders()}
        notice={signInErrorMessage(typeof error === "string" ? error : undefined)}
      />
    </AuthShell>
  );
}
