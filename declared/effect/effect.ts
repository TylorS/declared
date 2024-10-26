import * as Cause from "@declared/cause";
import * as Context from "@declared/context";
import * as Either from "@declared/either";
import * as Exit from "@declared/exit";
import * as Option from "@declared/option";
import { type Pipeable, pipeArguments } from "@declared/pipeable";
import type * as Tag from "@declared/tag";
import { EffectFailure } from "../internal/effect_failure.ts";
import { MapIterable } from "../internal/generators.ts";
import { stringify } from "../internal/stringify.ts";
import { flow } from "../mod.ts";

export interface Effect<Resources, Error, Success> extends Pipeable {
  readonly [Symbol.asyncIterator]: () => Effect.Iterator<
    Effect.Instruction<Resources, Error, Success>,
    Success
  >;
}

const Proto = {
  pipe() {
    return pipeArguments(this, arguments);
  },
};

export function gen<
  Yield extends Effect.Instruction<any, any, any>,
  Success,
>(
  f: () => AsyncGenerator<Yield, Success>,
): Effect<
  Effect.Instruction.Resources<Yield>,
  Effect.Instruction.Error<Yield>,
  Success
> {
  const effect = Object.create(Proto);
  effect[Symbol.asyncIterator] = f;
  return effect;
}

export declare namespace Effect {
  export type Instruction<Resources, Error, Success> =
    | Cause.Cause<Error>
    | Either.Either<Error, Success>
    | Exit.Exit<Error, Success>
    | Option.Option<Success>
    | Tag.Tag<Resources, Success>;

  export namespace Instruction {
    export type Resources<T> = [T] extends [Tag.Tag<infer _Resources, any>]
      ? _Resources
      : never;

    export type Error<T> = [T] extends [Cause.Cause<infer _Error>] ? _Error
      : [T] extends [Either.Left<infer _Error>] ? _Error
      : [T] extends [Exit.Exit<infer _Error, any>] ? _Error
      : never;

    export type Success<T> = [T] extends [Instruction<any, any, infer _Success>]
      ? _Success
      : never;
  }

  export type Resources<T> = T extends Effect<infer _Resources, any, any>
    ? _Resources
    : never;

  export type Error<T> = T extends Effect<any, infer _Error, any> ? _Error
    : never;

  export type Success<T> = T extends Effect<any, any, infer _Success> ? _Success
    : never;

  export interface Iterator<I, O> extends globalThis.AsyncIterator<I, O> {
    throw: NonNullable<globalThis.AsyncIterator<I, O>["throw"]>;
    return: NonNullable<globalThis.AsyncIterator<I, O>["return"]>;
  }
}

export async function run<Error, Success>(
  effect: Effect<never, Error, Success>,
): Promise<Success> {
  const generator = effect[Symbol.asyncIterator]();
  let result = await generator.next();

  const onSuccess = async (value: any) => {
    result = await generator.next(value);
  };

  const onFailure = async (error: Cause.Cause<any>) => {
    try {
      result = await generator.throw(error);
    } catch (e) {
      throw getEffectFailure(e);
    }
  };

  while (!result.done) {
    const instruction = result.value;
    switch (instruction._id) {
      case "Right":
      case "Success":
      case "Some": {
        await onSuccess(instruction.value);
        break;
      }
      case "Tag": {
        await onFailure(
          Cause.unexpected(
            new Error(`No service provided for ${instruction.identifier}`),
          ),
        );
        break;
      }
      case "Failure": {
        await onFailure(instruction.cause);
        break;
      }
      case "Left": {
        await onFailure(Cause.expected(instruction.value));
        break;
      }
      case "None": {
        await onFailure(Cause.empty);
        break;
      }
      case "Empty":
      case "Interrupted":
      case "Concurrent":
      case "Sequential":
      case "Expected":
      case "Unexpected": {
        await onFailure(instruction);
        break;
      }
      default: {
        await onFailure(
          Cause.unexpected(
            new Error(`Unhandled instruction: ${stringify(instruction)}`),
          ),
        );
      }
    }
  }

  return result.value;
}

function getEffectFailure(u: unknown): EffectFailure<unknown> {
  if (Cause.isCause(u)) return new EffectFailure(u);
  if (u instanceof EffectFailure) return u;
  return new EffectFailure(Cause.unexpected(u));
}

export function succeed<const Success>(
  value: Success,
): Effect<never, never, Success> {
  return Either.right(value);
}

export function fail<const Error>(error: Error): Effect<never, Error, never> {
  return Either.left(error);
}

export const interrupt: Effect<never, never, never> = Cause.interrupted;

class MapEffect<R, E, A, B>
  extends MapIterable<Effect.Instruction<R, E, any>, A, B>
  implements Effect<R, E, B> {
  constructor(
    readonly effect: Effect<R, E, A>,
    map: (a: A) => B,
  ) {
    super(effect, map);
  }
}

export function map<A, const B>(
  f: (a: A) => B,
): <R, E>(effect: Effect<R, E, A>) => Effect<R, E, B> {
  return (effect) =>
    effect instanceof MapEffect
      // Functor law
      ? new MapEffect(effect.effect, flow(effect.map, f))
      : new MapEffect(effect, f);
}

export function flatMap<A, R2, E2, B>(
  f: (a: A) => Effect<R2, E2, B>,
): <R, E>(effect: Effect<R, E, A>) => Effect<R2 | R, E2 | E, B> {
  return (effect) => {
    if (effect instanceof MapEffect) {
      return flatMapMapEffect(effect, f);
    }

    return flatMapAny(effect, f);
  };
}

export function provideContext<R2>(context: Context.Context<R2>): <R, E, A>(
  effect: Effect<R, E, A>,
) => Effect<R2 | R, E, A> {
  return (effect) =>
    gen(async function* () {
      const generator = effect[Symbol.asyncIterator]();
      let result = await generator.next();

      while (!result.done) {
        const instruction = result.value;
        switch (instruction._id) {
          case "Tag": {
            const service = context.pipe(Context.get(instruction));
            if (Option.isSome(service)) {
              result = await generator.next(service.value);
            } else {
              result = yield instruction;
            }
            break;
          }
          default: {
            result = await generator.next(instruction);
          }
        }
      }

      return result.value;
    });
}

function flatMapMapEffect<R, E, A, R2, E2, B>(
  effect: MapEffect<R, E, any, A>,
  f: (a: A) => Effect<R2, E2, B>,
): Effect<R2 | R, E2 | E, B> {
  return gen(async function* () {
    return yield* f(effect.map(yield* effect.effect));
  });
}

function flatMapAny<R, E, A, R2, E2, B>(
  effect: Effect<R, E, A>,
  f: (a: A) => Effect<R2, E2, B>,
): Effect<R2 | R, E2 | E, B> {
  return gen(async function* () {
    return yield* f(yield* effect);
  });
}
