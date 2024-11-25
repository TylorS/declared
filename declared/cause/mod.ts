import * as Array from "@declared/array";
import * as AsyncIterable from "@declared/async_iterable";
import * as internal_stringify from "../internal/stringify.ts";
import { pipe } from "@declared/function";

export type Cause<E> =
  | Empty
  | Expected<E>
  | Unexpected
  | Interrupted
  | Sequential<E>
  | Concurrent<E>;

export class Empty extends AsyncIterable.Failure("Empty") {}

export class Expected<E> extends AsyncIterable.Failure("Expected")<E> {}

export class Unexpected extends AsyncIterable.Failure("Unexpected")<unknown> {}

export class Interrupted extends AsyncIterable.Failure("Interrupted") {}

export class Sequential<E> extends AsyncIterable.AggregateFailure("Sequential")<
  Array.NonEmptyArray<Cause<E>>
> {}

export class Concurrent<E> extends AsyncIterable.AggregateFailure("Concurrent")<
  Array.NonEmptyArray<Cause<E>>
> {}

export const empty = (): Cause<never> => new Empty();
export const expected = <E>(expected: E): Cause<E> => new Expected(expected);
export const unexpected = (defect: unknown): Cause<never> =>
  new Unexpected(defect);
export const interrupted = (): Cause<never> => new Interrupted();

const flattenSequential = <E>(
  c: Cause<E> | Array.NonEmptyArray<Cause<E>>,
): Array.NonEmptyArray<Cause<E>> =>
  Array.isArray(c)
    ? pipe(c, Array.flatMap(flattenSequential))
    : isSequential(c)
    ? c.cause
    : [c];

export const sequential = <E>(
  ...causes: Array.NonEmptyArray<Cause<E> | Array.NonEmptyArray<Cause<E>>>
): Cause<E> =>
  new Sequential(
    pipe(causes, Array.flatMap(flattenSequential)),
  );

const flattenConcurrent = <E>(
  c: Cause<E> | Array.NonEmptyArray<Cause<E>>,
): Array.NonEmptyArray<Cause<E>> =>
  Array.isArray(c)
    ? pipe(c, Array.flatMap(flattenConcurrent))
    : isConcurrent(c)
    ? c.cause
    : [c];

export const concurrent = <E>(
  ...causes: Array.NonEmptyArray<Cause<E> | Array.NonEmptyArray<Cause<E>>>
): Cause<E> => new Concurrent(pipe(causes, Array.flatMap(flattenConcurrent)));

export const isEmpty = <E>(cause: Cause<E>): cause is Empty =>
  cause._id === Empty._id;

export const isExpected = <E>(cause: Cause<E>): cause is Expected<E> =>
  cause._id === Expected._id;

export const isUnexpected = <E>(cause: Cause<E>): cause is Unexpected =>
  cause._id === Unexpected._id;

export const isInterrupted = <E>(cause: Cause<E>): cause is Interrupted =>
  cause._id === Interrupted._id;

export const isSequential = <E>(cause: Cause<E>): cause is Sequential<E> =>
  cause._id === Sequential._id;

export const isConcurrent = <E>(cause: Cause<E>): cause is Concurrent<E> =>
  cause._id === Concurrent._id;

export const match = <E, A>(
  {
    onEmpty,
    onExpected,
    onUnexpected,
    onInterrupted,
    onSequential,
    onConcurrent,
  }: {
    onEmpty: () => A;
    onExpected: (expected: E) => A;
    onUnexpected: (unexpected: unknown) => A;
    onInterrupted: () => A;
    onSequential: (sequential: Array.NonEmptyArray<Cause<E>>) => A;
    onConcurrent: (concurrent: Array.NonEmptyArray<Cause<E>>) => A;
  },
) =>
(cause: Cause<E>): A => {
  if (isEmpty(cause)) return onEmpty();
  if (isExpected(cause)) return onExpected(cause.cause);
  if (isUnexpected(cause)) return onUnexpected(cause.cause);
  if (isInterrupted(cause)) return onInterrupted();
  if (isSequential(cause)) return onSequential(cause.cause);
  if (isConcurrent(cause)) return onConcurrent(cause.cause);
  throw new Error(
    `Unhandled cause type encountered in Cause.match(). This likely indicates a new Cause variant was added without updating the match function. Received cause: ${
      JSON.stringify(cause)
    }`,
  );
};

export const find = <E, C2 extends Cause<E>>(
  predicate: (c: Cause<E>) => c is C2,
) =>
(cause: Cause<E>): C2 | null => {
  if (predicate(cause)) return cause;
  else if (isSequential(cause)) {
    for (const c of cause.cause) {
      const result = find(predicate)(c);
      if (result !== null) return result;
    }
    return null;
  } else if (isConcurrent(cause)) {
    for (const c of cause.cause) {
      const result = find(predicate)(c);
      if (result !== null) return result;
    }
    return null;
  } else {
    return null;
  }
};

export const expectedOrNever = <E, R1, R2>(
  onFailure: (e: E) => R1,
  onNever: (cause: Cause<never>) => R2,
) =>
(cause: Cause<E>): R1 | R2 => {
  const failure = find(isExpected)(cause);
  return failure ? onFailure(failure.cause) : onNever(cause as Cause<never>);
};

export const stringify = <E>(cause: Cause<E>): string =>
  internal_stringify.stringify(cause);
