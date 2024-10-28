import * as Cause from "@declared/cause";
import * as Context from "@declared/context";
import * as LocalVars from "@declared/local_vars";
import * as Scope from "@declared/scope";
import { Tag } from "@declared/tag";
import { expect } from "jsr:@std/expect";
import assert from "node:assert";
import * as Effect from "./effect.ts";

// Helper for type tests
const expectType = <T>(_value: T) => {
  // This function exists just for type checking
};

Deno.test("Effect - success cases", async (t) => {
  await t.step("succeed creates successful effect", async () => {
    const result = await Effect.run(Effect.succeed("hello"));
    expect(result).toBe("hello");
  });

  await t.step("can pipe multiple successful effects", async () => {
    const effect = Effect.succeed(1)
      .pipe(Effect.map((n) => n + 1), Effect.map((n) => n * 2));

    const result = await Effect.run(effect);
    expect(result).toBe(4);
  });
});

Deno.test("Effect - failure cases", async (t) => {
  await t.step("empty failure", async () => {
    const exit = await Effect.runExit(Effect.none);
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
      Effect.map((n) => n * 2),
    );

    const runtime = Effect.makeRuntime(
      Context.make(NumberService, 42),
      LocalVars.make(),
      Scope.make(),
    );

    const result = await runtime.run(program);
    expect(result).toBe(84);
  });

  await t.step("fails when service is not found", async () => {
    const UnknownService = Tag<{ _id: string }>("UnknownService");

    try {
      await Effect.run(UnknownService as any);
      throw new Error("Should not succeed");
    } catch (error) {
      assert(error instanceof Error);
      console.log(error.toString());
      assert(error.toString().includes("Service not found"));
    }
  });
});

// Deno.test("Effect - fiber operations", async (t) => {
//   await t.step("can fork and join fibers", async () => {
//     const effect = Effect.succeed("test");
//     const fiber = Effect.runFork(effect);
//     const result = await fiber.join;

//     expect(result._id).toBe("Success");
//     if (result._id === "Success") {
//       expect(result.value).toBe("test");
//     }
//   });

//   await t.step("can interrupt fibers", async () => {
//     const effect = Effect.interrupt();
//     try {
//       await Effect.run(effect);
//       throw new Error("Should not succeed");
//     } catch (error) {
//       expect(error).toBeInstanceOf(Cause.Interrupted);
//     }
//   });
// });

// Deno.test("Effect - error handling", async (t) => {
//   await t.step("can catch and recover from errors", async () => {
//     const failedEffect = Effect.expected("oops");
//     const recoveredEffect = failedEffect.pipe(
//       Effect.catchAll((error) => Effect.succeed(`recovered: ${error.error}`)),
//     );

//     const result = await Effect.run(recoveredEffect);
//     expect(result).toBe("recovered: oops");
//   });

//   await t.step("can transform errors", async () => {
//     const failedEffect = Effect.expected("error1");
//     const transformedEffect = failedEffect.pipe(
//       Effect.mapError((error) => `transformed: ${error.error}`),
//     );

//     try {
//       await Effect.run(transformedEffect);
//       throw new Error("Should not succeed");
//     } catch (error) {
//       expect(error).toBeInstanceOf(Cause.Expected);
//       expect(error.error).toBe("transformed: error1");
//     }
//   });
// });

// Deno.test("Effect - type safety", async (t) => {
//   await t.step("maintains proper type information", () => {
//     const effect = Effect.succeed(42);

//     // Should compile
//     expectType<Effect.Effect<never, never, number>>(effect);

//     const failableEffect = Effect.expected("error");
//     // Should compile
//     expectType<Effect.Effect<never, string, never>>(failableEffect);

//     const contextualEffect = Effect.serviceWith(
//       Tag<{ value: string }>(),
//       (s) => s.value,
//     );
//     // Should compile
//     expectType<Effect.Effect<{ value: string }, never, string>>(
//       contextualEffect,
//     );
//   });
// });

// Deno.test("Effect - local variables", async (t) => {
//   await t.step("can manage local variables", async () => {
//     const localVar = LocalVars.make();
//     const runtime = Effect.makeRuntime(
//       Context.empty,
//       localVar,
//       Effect.Scope.make(),
//     );

//     const effect = LocalVars.get(localVar).pipe(
//       Effect.map((value) => value ?? "default"),
//     );

//     const result = await runtime.run(effect);
//     expect(result).toBe("default");
//   });
// });
