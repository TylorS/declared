import * as AsyncIterable from "@declared/async_iterable";
import { identity } from "@declared/function";

export class LocalVar<in out T> extends AsyncIterable.Yieldable(`LocalVar`)<T> {
  constructor(
    readonly initialize: () => T,
    readonly fork: (value: T) => T,
    readonly join: (existing: T, incoming: T) => T,
  ) {
    super();
  }
}

export const make = <T>(
  initialize: () => T,
  fork: (value: T) => T = identity,
  join: (existing: T, incoming: T) => T = identity,
): LocalVar<T> => new LocalVar(initialize, fork, join);
