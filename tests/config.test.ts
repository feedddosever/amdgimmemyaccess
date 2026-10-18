import { describe, expect, it } from "vitest";
import { apiKey } from "@/lib/config";

describe("apiKey", () => {
  it("restores the lowercase rc- prefix of a Token Factory key", () => {
    expect(apiKey(`Rc-${"ab12".repeat(12)}`)).toBe(`rc-${"ab12".repeat(12)}`);
    expect(apiKey(`RC-${"ab12".repeat(12)}`)).toBe(`rc-${"ab12".repeat(12)}`);
  });

  it("leaves other keys alone apart from surrounding spaces", () => {
    expect(apiKey(" vllm-Secret ")).toBe("vllm-Secret");
    expect(apiKey(undefined)).toBe("");
  });
});
