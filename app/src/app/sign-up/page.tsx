import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { configuredProviders, signInErrorMessage } from "@/lib/auth-providers";
import { getSession } from "@/lib/session";

/** The first value of a search parameter. */
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  if (await getSession()) redirect("/chats");
  const { error, from } = await searchParams;
  return (
    <AuthShell
      title="Plant your park"
      footer={{ text: "Already have an account?", linkText: "Sign in", href: "/sign-in" }}
    >
      <SignInForm
        mode="sign-up"
        providers={configuredProviders()}
        notice={signInErrorMessage(one(error), one(from))}
      />
    </AuthShell>
  );
}
