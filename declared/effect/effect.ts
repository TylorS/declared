import type { Cause } from "@declared/cause";
import type { Either } from "@declared/either";
import type { Exit } from "@declared/exit";
import type { Tag } from "@declared/tag";

export interface Effect<in out Resources, out Error, out Success> {
  readonly [Symbol.iterator]: () => Iterator<
    Effect.Instruction<Resources, Error, any>,
    Success
  >;
}

export function Effect<
  Yield extends Effect.Instruction<any, any, any>,
  Success,
>(
  f: () => Generator<Yield, Success>,
): Effect<
  Yield extends Effect.Instruction<infer Resources, infer Error, infer Success>
    ? Resources
    : never,
  Yield extends Effect.Instruction<infer Resources, infer Error, infer Success>
    ? Error
    : never,
  Success
> {
  return {
    [Symbol.iterator]: f,
  };
}

export declare namespace Effect {
  export interface Variance<Resources, Error, Success> {
    readonly _Resources: (_: Resources) => Resources;
    readonly _Error: (_: never) => Error;
    readonly _Success: (_: never) => Success;
  }

  export type Instruction<Resources, Error, Success> =
    | Cause<Error>
    | Either<Error, Success>
    | Exit<Error, Success>
    | Tag<Resources, Success>;
}
