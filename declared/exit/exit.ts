import * as Cause from "@declared/cause";
import type { Effect } from "../effect/effect.ts";
import { ThisIterable } from "../internal/generators.ts";
import type { Pipeable } from "@declared/pipeable";

export type Exit<Error, Output> = Failure<Error> | Success<Output>;

export interface Failure<out E> extends Error, Effect<never, E, never> {
  readonly _id: "Failure";
  readonly cause: Cause.Cause<E>;
}

export interface Success<out Output> extends Pipeable {
  readonly _id: "Success";
  readonly value: Output;
}

export function failure<Error, Output = never>(
  error: Cause.Cause<Error>,
): Exit<Error, Output> {
  const failure = Object.create(ThisIterable);
  failure._id = "Failure";
  failure.error = error;
  return failure;
}

export function success<const Output, Error = never>(
  value: Output,
): Exit<Error, Output> {
  const success = Object.create(ThisIterable);
  success._id = "Success";
  success.value = value;
  return success;
}
