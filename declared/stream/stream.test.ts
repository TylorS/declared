import * as Cause from "@declared/cause";
import * as Duration from "@declared/duration";
import { Task } from "@declared/stream";
import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std/assert/mod.ts";
import * as Stream from "./stream.ts";

Deno.test("Stream basics", async (t) => {
  await t.step("of - emits a single value", async () => {
    assertEquals(await Stream.toArray(Stream.of(1)), [1]);
  });

  await t.step("fromArray - emits multiple values in order", async () => {
    assertEquals(await Stream.toArray(Stream.fromArray([1, 2, 3])), [1, 2, 3]);
  });
});

Deno.test("Stream operators", async (t) => {
  await t.step("flatMap - processes values concurrently", async () => {
    const values = await Stream.fromArray([1, 2, 3]).pipe(
      Stream.flatMap((n) =>
        Stream.of(n + 1).pipe(
          Stream.delay(Duration.millis(300 - (n * 100))),
        )
      ),
      Stream.toArray,
    );
    assertEquals(values, [4, 3, 2]);
  });

  await t.step(
    "switchMap - processes latest value after completion",
    async () => {
      const values = await Stream.fromArray([1, 2, 3]).pipe(
        Stream.switchMap((n) =>
          Stream.of(n + 1).pipe(
            Stream.delay(Duration.millis(300 - (n * 100))),
          )
        ),
        Stream.toArray,
      );
      assertEquals(values, [4]);
    },
  );

  await t.step(
    "exhaustMap - ignores new values while processing current value",
    async () => {
      const values = await Stream.fromArray([1, 2, 3]).pipe(
        Stream.exhaustMap((n) =>
          Stream.of(n + 1).pipe(
            Stream.delay(Duration.millis(300 - (n * 100))),
          )
        ),
        Stream.toArray,
      );
      assertEquals(values, [2]);
    },
  );

  await t.step(
    "exhaustLatestMap - ignores new values while processing current value",
    async () => {
      const values = await Stream.fromArray([1, 2, 3]).pipe(
        Stream.exhaustLatestMap((n) =>
          Stream.of(n + 1).pipe(
            Stream.delay(Duration.millis(300 - (n * 100))),
          )
        ),
        Stream.toArray,
      );
      assertEquals(values, [2, 4]);
    },
  );

  await t.step(
    "flatMapConcurrently - allows controlling the number of concurrent operations",
    async () => {
      const values = await Stream.fromArray([1, 2, 3]).pipe(
        Stream.flatMapConcurrently(
          (n) =>
            Stream.of(n + 1).pipe(
              Stream.delay(Duration.millis(300 - (n * 100))),
            ),
          1,
        ),
        Stream.toArray,
      );

      assertEquals(values, [2, 3, 4]);
    },
  );
});

Deno.test("Stream timing", async (t) => {
  await t.step("delay - delays emission of values", async () => {
    const start = performance.now();
    const values = await Stream.toArray(
      Stream.of(1).pipe(
        Stream.delay(Duration.millis(100)),
      ),
    );

    const elapsed = performance.now() - start;
    assertEquals(values, [1]);
    assertEquals(
      elapsed >= 95 && elapsed <= 150,
      true,
      "Should have delayed approximately 100ms",
    );
  });

  await t.step("periodic - emits values periodically", async () => {
    const values: number[] = [];
    const disposable = Stream.runFork(
      Stream.periodic(Duration.millis(50)).pipe(
        Stream.flatMap(() => {
          values.push(1);
          return Stream.of(undefined);
        }),
      ),
    );

    await new Promise((resolve) => setTimeout(resolve, 175)); // Should allow for 3 emissions
    await disposable[Symbol.asyncDispose]();

    assertEquals(values.length, 3, "Should have emitted 3 times");
  });
});

Deno.test("Stream error handling", async (t) => {
  await t.step("propagates errors", async () => {
    const cause = new Cause.Unexpected(new Error("test error"));

    await assertRejects(
      () =>
        Stream.run(
          Stream.failCause(cause),
        ),
      Cause.Unexpected,
      "test error",
    );
  });

  await t.step("cleans up on error", async () => {
    let disposed = false;

    const error = new Cause.Unexpected(new Error("test error"));

    await assertRejects(
      () =>
        Stream.run(
          Stream.make((sink, runtime) => {
            runtime.scheduler.asap(Task.propagateError(sink, error));
            return {
              [Symbol.dispose]: () => {
                disposed = true;
              },
            };
          }),
        ),
    );

    assertEquals(disposed, true, "Should have disposed the stream");
  });
});
