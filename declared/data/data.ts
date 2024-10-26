import * as Cause from "@declared/cause";
import type { Effect } from "@declared/effect";
import type { Exit } from "@declared/exit";
import { AsCauseIterable, ThisIterable } from "../internal/generators.ts";

export type Data<Error, Output> =
  | NoData
  | Loading
  | Exit<Error, Output>
  | Retrying<Error>
  | Refreshing<Output>;

export interface NoData extends Error, Effect<never, NoData, never> {
  readonly tag: "NoData";
}

class NoDataImpl extends AsCauseIterable<NoData> implements NoData {
  readonly tag = "NoData";
  constructor() {
    super(Cause.expected, "NoData");
  }
}

export const noData = (): NoData => new NoDataImpl();

export interface Loading extends Error, Effect<never, Loading, never> {}

class LoadingImpl extends AsCauseIterable<Loading> implements Loading {
  readonly tag = "Loading";
  constructor() {
    super(Cause.expected, "Loading");
  }
}

export const loading = (): Loading => new LoadingImpl();

export interface Retrying<E> extends Error, Effect<never, E, never> {
  readonly tag: "Retrying";
  readonly cause: Cause.Cause<E>;
}

export interface Refreshing<Output> extends Effect<never, never, Output> {
  readonly tag: "Refreshing";
  readonly output: Output;
}

class RetryingImpl<E> extends AsCauseIterable<E> implements Retrying<E> {
  readonly tag = "Retrying";
  constructor(override readonly cause: Cause.Cause<E>) {
    super(() => cause, "Retrying");
  }
}

export function retrying<Error>(cause: Cause.Cause<Error>): Retrying<Error> {
  return new RetryingImpl(cause);
}

export function refreshing<const Output>(output: Output): Refreshing<Output> {
  const refreshing = Object.create(ThisIterable);
  refreshing.tag = "Refreshing";
  refreshing.output = output;
  return refreshing;
}
