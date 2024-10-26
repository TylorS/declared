import { describe, expect, it } from "vitest";
import * as Effect from "./effect.ts";

describe("Effect", () => {
  it("runs synchronous effects", async () => {
    const success = Effect.succeed("hello");
    expect(await Effect.run(success)).toBe("hello");

    const failure = Effect.fail("error");
    await expect(Effect.run(failure)).rejects.toThrowErrorMatchingInlineSnapshot(`
      [Error: {
        tag: "Expected",
        error: "error",
        message: "Expected Failure"
      }]
    `);
  });

  it("maps effects", async () => {
    const effect = Effect.succeed(1).pipe(Effect.map((a) => a + 1));
    expect(await Effect.run(effect)).toBe(2);
  });
});
