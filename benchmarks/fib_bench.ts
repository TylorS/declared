import { Effect as EffectTs } from "npm:effect";
import * as Effect from '@declared/effect'

const fib_effect_ts = (n: number): EffectTs.Effect<number> => {
  if (n <= 1) return EffectTs.succeed(n);
  return EffectTs.zipWith(fib_effect_ts(n - 1), fib_effect_ts(n - 2), (a, b) => a + b);
};

const fib_effect = (n: number): Effect.Effect<never, never, number> => {
  if (n <= 1) return Effect.success(n);
  return fib_effect(n - 1).pipe(Effect.zipWith(fib_effect(n - 2), (a, b) => a + b));
};

Deno.bench({
  name: "[effect-ts] fib 20",
  fn: async () => {
    await EffectTs.runPromise(fib_effect_ts(20));
  },
});

Deno.bench({
  name: "[declared] fib 20",
  fn: async () => {
    await Effect.run(fib_effect(20));
  },
});
