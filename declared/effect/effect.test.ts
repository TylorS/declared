import * as Cause from "@declared/cause";
import * as Context from "@declared/context";
import * as LocalVar from "@declared/local_var";
import { Tag } from "@declared/tag";
import { assertEquals } from "deno-assert";
import { expect } from "jsr:@std/expect";
import assert from "node:assert";
import { stringify } from "../internal/stringify.ts";
import { Exit } from "../mod.ts";
import * as Effect from "./effect.ts";

Deno.test("Effect - success cases", async (t) => {
  await t.step("succeed creates successful effect", async () => {
    const result = await Effect.run(Effect.success("hello"));
    expect(result).toBe("hello");
  });

  await t.step("can pipe multiple successful effects", async () => {
    const effect = Effect.success(1)
      .pipe(Effect.map((n) => n + 1), Effect.map((n) => n * 2));

    const result = await Effect.run(effect);
    expect(result).toBe(4);
  });
});

Deno.test("Effect - failure cases", async (t) => {
  await t.step("empty failure", async () => {
    const exit = await Effect.runExit(Effect.none());
    if (exit._id === "Failure") {
      expect(exit.cause._id).toBe("Empty");
    } else {
      throw new Error("Should not succeed");
    }
  });

  await t.step("expected error", async () => {
    const effect = Effect.expected("custom error");
    const exit = await Effect.runExit(effect);
    if (exit._id === "Failure") {
      expect(exit.cause._id).toBe("Expected");
      expect(exit.cause.cause).toBe("custom error");
    } else {
      throw new Error("Should not succeed");
    }
  });

  await t.step("unexpected error", async () => {
    const error = new Error("boom");
    const effect = Effect.unexpected(error);
    try {
      await Effect.run(effect);
      throw new Error("Should not succeed");
    } catch (e) {
      expect(e).toEqual(new Cause.Unexpected(error));
    }
  });
});

Deno.test("Effect - context management", async (t) => {
  await t.step("can provide and retrieve context", async () => {
    // Define a service
    interface NumberService {
      readonly _id: unique symbol;
    }
    const NumberService = Tag<NumberService, number>("NumberService");

    const program = NumberService.pipe(
      Effect.service,
      Effect.map((n) => n * 2),
    );

    const runtime = {
      ...Effect.defaultRuntime,
      context: Context.make(NumberService, 42),
    };

    const result = await program.run(runtime);
    assert(Exit.isSuccess(result));
    expect(result.value).toBe(84);
  });

  await t.step("fails when service is not found", async () => {
    const UnknownService = Tag<{ _id: string }>("UnknownService");

    try {
      await Effect.run(Effect.service(UnknownService) as any);
      throw new Error("Should not succeed");
    } catch (error) {
      assert(stringify(error).includes("Service not found"));
    }
  });
});

Deno.test("Effect - fiber operations", async (t) => {
  await t.step("can fork and join fibers", async () => {
    const effect = Effect.success("test");
    const fiber = Effect.runFork(effect);
    const result = await fiber.exit;

    expect(result._id).toBe("Success");
    if (result._id === "Success") {
      expect(result.value).toBe("test");
    }
  });

  await t.step("can interrupt fibers", async () => {
    let run = false;
    const effect = Effect.gen(async function* test() {
      const fiber = yield* Effect.fork(
        Effect.sleep({ millis: 1000 }).pipe(
          Effect.map(() => {
            run = true;
          }),
        ),
      );

      expect(run).toBe(false);
      yield* Effect.dispose(fiber);
      const exit = await fiber.exit;
      expect(exit._id).toBe("Failure");
      if (exit._id === "Failure") {
        expect(exit.cause._id).toBe("Interrupted");
      }

      expect(run).toBe(false);
    });

    await Effect.runExit(effect);
  });
});

Deno.test("Effect - error handling", async (t) => {
  await t.step("can catch and recover from errors", async () => {
    const failedEffect = Effect.expected("oops");
    const recoveredEffect = failedEffect.pipe(
      Effect.catchAll((error) => Effect.success(`recovered: ${error.message}`)),
    );

    const result = await Effect.run(recoveredEffect);
    expect(result).toBe(`recovered: "oops"`);
  });
});

Deno.test("Effect - local variables", async (t) => {
  await t.step("can manage local variables", async () => {
    const foo = LocalVar.make(() => "foo");
    await Effect.run(Effect.gen(async function* () {
      const initial = yield* foo;
      expect(initial).toBe("foo");
      const updated = yield* foo.pipe(Effect.setLocalVar("bar"));
      expect(updated).toBe("bar");
      expect(updated).toBe(yield* foo);
    }));
  });
});

Deno.test("Effect - uninterruptible regions", async () => {
  let executed = false;

  const effect = Effect.gen(async function* () {
    // This region cannot be interrupted
    yield* Effect.uninterruptible(Effect.gen(async function* () {
      // deno-lint-ignore require-await
      yield* Effect.fromPromise(async () => {
        executed = true;
      });
    }));
  });

  const fiber = Effect.runFork(effect);

  // Try to interrupt
  await fiber[Symbol.asyncDispose]();

  // Wait for the fiber to complete
  const exit = await fiber.exit;

  // The code in uninterruptible should have executed despite interruption
  assertEquals(executed, true);
  assert(exit._id === "Failure");
  assertEquals(exit.cause, new Cause.Interrupted());
});
