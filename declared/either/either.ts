import type { Effect } from "../effect/effect.ts";
import { ErrorIterable, ThisIterable } from "../internal/generators.ts";

export type Either<Error, Success> = Left<Error> | Right<Success>;

export interface Left<out E> extends Effect<never, E, never> {
  readonly _id: "Left";
  readonly value: E;
}

export interface Right<out Success> extends Effect<never, never, Success> {
  readonly _id: "Right";
  readonly value: Success;
}

export function left<const Error>(
  error: Error,
): Left<Error> {
  const left = Object.create(ErrorIterable.prototype);
  left._id = "Left";
  left.value = error;
  return left;
}

export function right<const Success>(
  success: Success,
): Right<Success> {
  const right = Object.create(ThisIterable.prototype);
  right._id = "Right";
  right.value = success;
  return right;
}
