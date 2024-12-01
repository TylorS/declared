import * as Effect from "@declared/effect";
import * as EffectTs from "npm:effect/Effect";

const effect_ts_gen = EffectTs.forEach(
  Array.from({ length: 100 }, (_, i) => i),
  (i) =>
    EffectTs.gen(function* () {
      // Simulate some async data processing
      const data = yield* EffectTs.succeed(i);

      // Simulate transformation
      yield* EffectTs.promise(() =>
        new Promise<number>(resolve =>
          setTimeout(() => resolve(data * 2), 1)
        )
      );

      // Simulate aggregation
      yield* EffectTs.promise(() =>
        new Promise<void>(resolve =>
          setTimeout(() => resolve(), 1)
        )
      );
    }),
  { concurrency: "unbounded" }
).pipe(EffectTs.as("Done processing"));

const effect_gen = Array.from({ length: 100 }, (_, i) => i).pipe(
  Effect.forEach((i) =>
    Effect.gen(async function* () {
      // Simulate some async data processing
      const data = yield* Effect.success(i);

      // Simulate transformation
      yield* Effect.fromPromise(() =>
        new Promise<number>(resolve =>
          setTimeout(() => resolve(data * 2), 1)
        )
      );

      // Simulate aggregation
      yield* Effect.fromPromise(() =>
        new Promise<void>(resolve =>
          setTimeout(() => resolve(), 1)
        )
      );
    })
  ),
  Effect.as("Done processing")
);

Deno.bench({
  name: "[effect-ts] generator 1000",
  fn: async () => {
    await EffectTs.runPromise(effect_ts_gen);
  },
});

Deno.bench({
  name: "[declared] generator 1000",
  fn: async () => {
    await Effect.run(effect_gen);
  },
});
