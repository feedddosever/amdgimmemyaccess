import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CLAUDE.md rule 6: every config variable the app reads must be listed in .env.example.
const brief = readFileSync("CLAUDE.md", "utf8");
const example = readFileSync(".env.example", "utf8");

const listed = brief.match(/Read config from env: ([A-Z_, ]+)\./)?.[1].split(/,\s*/) ?? [];
const defined = new Set(
  example
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)=/)?.[1])
    .filter((name): name is string => Boolean(name)),
);

describe(".env.example", () => {
  it("finds the variable list in CLAUDE.md", () => {
    expect(listed.length).toBeGreaterThan(0);
  });

  it.each(listed)("defines %s", (name) => {
    expect(defined.has(name)).toBe(true);
  });
});
