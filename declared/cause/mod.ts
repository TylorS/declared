import type { NonEmptyArray } from "@declared/array";
import type { Effect } from "@declared/effect";
import { ThisIterable } from "../internal/generators.ts";

export type Cause<E> =
  | Expected<E>
  | Unexpected
  | Interrupted
  | Sequential<E>
  | Concurrent<E>;

export interface Expected<E> extends Effect<never, E, never> {
  readonly tag: "Expected";
  readonly error: E;
}

export interface Unexpected extends Effect<never, never, never> {
  readonly tag: "Unexpected";
  readonly error: unknown;
}

export interface Interrupted extends Effect<never, never, never> {
  readonly tag: "Interrupted";
}

export interface Sequential<E> extends Effect<never, E, never> {
  readonly tag: "Sequential";
  readonly errors: NonEmptyArray<Cause<E>>;
}

export interface Concurrent<E> extends Effect<never, E, never> {
  readonly tag: "Concurrent";
  readonly errors: NonEmptyArray<Cause<E>>;
}

export function expected<const E>(error: E): Expected<E> {
  const expected = Object.create(ThisIterable);
  expected.tag = "Expected";
  expected.error = error;
  return expected;
}

export function unexpected(error: unknown): Unexpected {
  const unexpected = Object.create(ThisIterable);
  unexpected.tag = "Unexpected";
  unexpected.error = error;
  return unexpected;
}

export const interrupted: Interrupted =
  new (class extends ThisIterable<never> implements Interrupted {
    readonly tag = "Interrupted";
  })();

export function sequential<E>(errors: NonEmptyArray<Cause<E>>): Sequential<E> {
  const sequential = Object.create(ThisIterable);
  sequential.tag = "Sequential";
  sequential.errors = errors;
  return sequential;
}

export function concurrent<E>(errors: NonEmptyArray<Cause<E>>): Concurrent<E> {
  const concurrent = Object.create(ThisIterable);
  concurrent.tag = "Concurrent";
  concurrent.errors = errors;
  return concurrent;
}
