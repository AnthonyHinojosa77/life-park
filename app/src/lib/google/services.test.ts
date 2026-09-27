import { describe, expect, it } from "vitest";
import { grantedServices, scopesFor } from "./services";

describe("google services", () => {
  it("collects scopes without repeats", () => {
    const scopes = scopesFor(["drive", "docs", "sheets"]);
    expect(scopes.filter((s) => s.endsWith("drive.metadata.readonly"))).toHaveLength(1);
    expect(scopes).toHaveLength(3);
  });

  it("ignores unknown services", () => {
    expect(scopesFor(["keep"])).toEqual([]);
  });

  it("counts a service only when every scope was granted", () => {
    const granted = [
      "openid",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/documents.readonly",
    ].join(",");
    expect(grantedServices(granted)).toEqual(["calendar"]);
    expect(grantedServices(null)).toEqual([]);
  });

  it("reads space- or comma-separated scope lists", () => {
    expect(grantedServices("https://www.googleapis.com/auth/tasks.readonly openid")).toEqual(["tasks"]);
  });
});
