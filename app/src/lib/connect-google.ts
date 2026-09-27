"use client";

import { authClient } from "./auth-client";
import { scopesFor } from "./google/services";

/**
 * Sends the person to Google to allow read access to the chosen services.
 * Google returns them to `back`, where the park imports what was allowed.
 */
export async function connectGoogle(services: readonly string[], back = "/park") {
  const { error } = await authClient.linkSocial({
    provider: "google",
    scopes: scopesFor(services),
    callbackURL: back,
    errorCallbackURL: `${back}${back.includes("?") ? "&" : "?"}connect=failed`,
    // Asking again guarantees Google sends a long-lived key, so imports keep working later.
    additionalParams: { prompt: "consent", access_type: "offline" },
  });
  if (error) throw new Error(error.message || "Couldn't reach Google.");
}
