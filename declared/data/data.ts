import * as Cause from "@declared/cause";
import type { Effect } from "@declared/effect";
import type { Exit } from "@declared/exit";
import { OnceIterator, ThisIterable } from "../internal/generators.ts";

export type Data<Error, Output> =
  | NoData
  | Loading
  | Exit<Error, Output>
  | Retrying<Error>
  | Refreshing<Output>;

export interface NoData extends Effect<never, NoData, never> {
  readonly tag: "NoData";
}

export const NoData: NoData = new (class implements NoData {
  readonly tag = "NoData";
  [Symbol.iterator] = (): Iterator<Cause.Cause<NoData>, never> =>
    new OnceIterator(Cause.expected<NoData>(this));
})();

export interface Loading extends Effect<never, Loading, never> {}

export const Loading: Loading = new (class implements Loading {
  readonly tag = "Loading";
  [Symbol.iterator] = (): Iterator<Cause.Cause<Loading>, never> =>
    new OnceIterator(Cause.expected<Loading>(this));
})();

export interface Retrying<Error> extends Effect<never, Error, never> {
  readonly tag: "Retrying";
  readonly cause: Cause.Cause<Error>;
}

export interface Refreshing<Output> extends Effect<never, never, Output> {
  readonly tag: "Refreshing";
  readonly output: Output;
}

export function retrying<Error>(cause: Cause.Cause<Error>): Retrying<Error> {
  const retrying = Object.create(ThisIterable);
  retrying.tag = "Retrying";
  retrying.cause = cause;
  return retrying;
}

export function refreshing<const Output>(output: Output): Refreshing<Output> {
  const refreshing = Object.create(ThisIterable);
  refreshing.tag = "Refreshing";
  refreshing.output = output;
  return refreshing;
}
