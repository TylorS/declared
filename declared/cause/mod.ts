import type { NonEmptyArray } from "@declared/array";
import * as AsyncIterable from "@declared/async_iterable";

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
  NonEmptyArray<Cause<E>>
> {}

export class Concurrent<E> extends AsyncIterable.AggregateFailure("Concurrent")<
  NonEmptyArray<Cause<E>>
> {}

export const empty = (): Cause<never> => new Empty();
export const expected = <E>(expected: E): Cause<E> => new Expected(expected);
export const unexpected = (defect: unknown): Cause<never> =>
  new Unexpected(defect);
export const interrupted = (): Cause<never> => new Interrupted();

export const sequential = <E>(
  ...causes: NonEmptyArray<Cause<E> | Array<Cause<E>>>
): Cause<E> =>
  new Sequential(causes.flat(1) as unknown as NonEmptyArray<Cause<E>>);

export const concurrent = <E>(
  ...causes: NonEmptyArray<Cause<E> | Array<Cause<E>>>
): Cause<E> =>
  new Concurrent(causes.flat(1) as unknown as NonEmptyArray<Cause<E>>);

export const isEmpty = <E>(cause: Cause<E>): cause is Empty =>
  cause._id === Empty._id;

export const isExpected = <E>(cause: Cause<E>): cause is Expected<E> =>
  cause._id === Expected._id;

export const isUnexpected = (cause: Cause<never>): cause is Unexpected =>
  cause._id === Unexpected._id;

export const isInterrupted = (cause: Cause<never>): cause is Interrupted =>
  cause._id === Interrupted._id;

export const isSequential = <E>(cause: Cause<E>): cause is Sequential<E> =>
  cause._id === Sequential._id;

export const isConcurrent = <E>(cause: Cause<E>): cause is Concurrent<E> =>
  cause._id === Concurrent._id;

export const match = <E, A>(
  onEmpty: () => A,
  onExpected: (expected: E) => A,
  onUnexpected: (unexpected: unknown) => A,
  onInterrupted: () => A,
  onSequential: (sequential: NonEmptyArray<Cause<E>>) => A,
  onConcurrent: (concurrent: NonEmptyArray<Cause<E>>) => A,
) =>
(cause: Cause<E>): A => {
  if (isEmpty(cause)) return onEmpty();
  if (isExpected(cause)) return onExpected(cause.cause);
  if (isUnexpected(cause)) return onUnexpected(cause.cause);
  if (isInterrupted(cause)) return onInterrupted();
  if (isSequential(cause)) {
    return onSequential(cause.cause as NonEmptyArray<Cause<E>>);
  }
  if (isConcurrent(cause)) {
    return onConcurrent(cause.cause as NonEmptyArray<Cause<E>>);
  }
  throw new Error(
    `Unhandled cause type encountered in Cause.match(). This likely indicates a new Cause variant was added without updating the match function. Received cause: ${
      JSON.stringify(cause)
    }`,
  );
};

export const expectedOrNever = <E, R1, R2>(
  onFailure: (e: E) => R1,
  onNever: (cause: Cause<never>) => R2,
) =>
(cause: Cause<E>): R1 | R2 => {
  if (isExpected(cause)) return onFailure(cause.cause);
  if (isSequential(cause) || isConcurrent(cause)) {
    const c = cause.cause as NonEmptyArray<Cause<E>>;
    const failure = c.find((c) => isExpected(c));
    return failure ? onFailure(failure.cause) : onNever(cause);
  }
  return onNever(cause);
};
