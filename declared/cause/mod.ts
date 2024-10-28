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
