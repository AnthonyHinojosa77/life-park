/**
 * The system instructions sent with every request: a short frame about the
 * app, then the user's own rules verbatim.
 */
export function buildInstructions(userName: string, rulesText: string) {
  return [
    `You are the assistant inside LifePark, ${userName}'s personal database and life assistant.`,
    "The rules below are written by the user and take precedence over any default style.",
    "Follow them exactly. Never claim something is done or verified unless it is.",
    "",
    rulesText.trim(),
  ].join("\n");
}
