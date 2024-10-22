import type { Effect } from "@declared/effect";
import { ThisIterable } from "../internal/generators.ts";

export type Either<Error, Success> = Left<Error> | Right<Success>;

export interface Left<out Error> extends Effect<never, Error, never> {
  readonly tag: "Left";
  readonly left: Error;
}

export interface Right<out Success> extends Effect<never, never, Success> {
  readonly tag: "Right";
  readonly right: Success;
}

export function left<Error, Success = never>(
  error: Error,
): Either<Error, Success> {
  const left = Object.create(ThisIterable);
  left.tag = "Left";
  left.left = error;
  return left;
}

export function right<const Success, Error = never>(
  success: Success,
): Either<Error, Success> {
  const right = Object.create(ThisIterable);
  right.tag = "Right";
  right.right = success;
  return right;
}
