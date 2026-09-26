import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, IconButton } from "./button";

describe("Button", () => {
  it("renders its label and defaults to the press variant", () => {
    render(<Button>Listen</Button>);
    const button = screen.getByRole("button", { name: "Listen" });
    expect(button.dataset.variant).toBe("press");
  });

  it("applies the stamp variant when asked, drawn in chalk with no floating shadow", () => {
    render(<Button variant="stamp">Open</Button>);
    const button = screen.getByRole("button", { name: "Open" });
    expect(button.dataset.variant).toBe("stamp");
    expect(button.className).not.toContain("shadow");
    expect(button.querySelector("svg rect")).not.toBeNull();
  });
});

describe("IconButton", () => {
  it("exposes its label to assistive technology", () => {
    render(
      <IconButton label="Send">
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeDefined();
  });
});
