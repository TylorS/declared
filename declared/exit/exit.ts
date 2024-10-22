import * as Cause from "@declared/cause";
import type { Effect } from "@declared/effect";
import { ThisIterable } from "../internal/generators.ts";

export type Exit<Error, Output> = Failure<Error> | Success<Output>;

export interface Failure<out Error> extends Effect<never, Error, never> {
  readonly tag: "Failure";
  readonly error: Cause.Cause<Error>;
}

export interface Success<out Output> extends Effect<never, never, Output> {
  readonly tag: "Success";
  readonly value: Output;
}

export function failure<Error, Output = never>(
  error: Cause.Cause<Error>,
): Exit<Error, Output> {
  const failure = Object.create(ThisIterable);
  failure.tag = "Failure";
  failure.error = error;
  return failure;
}

export function success<const Output, Error = never>(
  value: Output,
): Exit<Error, Output> {
  const success = Object.create(ThisIterable);
  success.tag = "Success";
  success.value = value;
  return success;
}
