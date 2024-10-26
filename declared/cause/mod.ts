import type { NonEmptyArray } from "@declared/array";
import { ErrorIterable } from "../internal/generators.ts";
import type { Effect } from "@declared/effect";

export type Cause<E> =
  | Empty
  | Expected<E>
  | Unexpected
  | Interrupted
  | Sequential<E>
  | Concurrent<E>;

export interface Empty extends Error, Effect<never, never, never> {
  readonly _id: "Empty";
}

export interface Expected<E> extends Error, Effect<never, E, never> {
  readonly _id: "Expected";
  readonly error: E;
}

export interface Unexpected extends Error, Effect<never, never, never> {
  readonly _id: "Unexpected";
  readonly error: unknown;
}

export interface Interrupted extends Error, Effect<never, never, never> {
  readonly _id: "Interrupted";
}

export interface Sequential<E> extends Error, Effect<never, E, never> {
  readonly _id: "Sequential";
  readonly errors: NonEmptyArray<Cause<E>>;
}

export interface Concurrent<E> extends Error, Effect<never, E, never> {
  readonly _id: "Concurrent";
  readonly errors: NonEmptyArray<Cause<E>>;
}

export const empty: Empty = new (class extends ErrorIterable implements Empty {
  readonly _id = "Empty";
})();

export function expected<const E>(error: E): Expected<E> {
  const expected = Object.create(ErrorIterable);
  expected._id = "Expected";
  expected.error = error;
  expected.message = `Expected Failure`;
  return expected;
}

export function unexpected(error: unknown): Unexpected {
  const unexpected = Object.create(ErrorIterable);
  unexpected._id = "Unexpected";
  unexpected.error = error;
  unexpected.message = `Unexpected Failure`;
  unexpected.cause = error;
  return unexpected;
}

export const interrupted: Interrupted =
  new (class extends ErrorIterable implements Interrupted {
    readonly _id = "Interrupted";
    override readonly message = "Interrupted";
  })();

export function sequential<E>(errors: NonEmptyArray<Cause<E>>): Sequential<E> {
  const sequential = Object.create(ErrorIterable);
  sequential._id = "Sequential";
  sequential.errors = errors;
  sequential.message = `Sequential Failure`;
  return sequential;
}

export function concurrent<E>(errors: NonEmptyArray<Cause<E>>): Concurrent<E> {
  const concurrent = Object.create(ErrorIterable);
  concurrent._id = "Concurrent";
  concurrent.errors = errors;
  concurrent.message = `Concurrent Failure`;
  return concurrent;
}

const all_ids = new Set([
  "Empty",
  "Expected",
  "Unexpected",
  "Interrupted",
  "Sequential",
  "Concurrent",
]);

export function isCause<E = unknown>(u: unknown): u is Cause<E> {
  return u !== null && typeof u === "object" &&
    all_ids.has((u as any)._id);
}

export class 