import * as AsyncIterable from "@declared/async_iterable";
import { constTrue, identity } from "@declared/function";
import { Deferred } from "../deferred/mod.ts";

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

export const InterruptStatus = make<boolean>(constTrue);
export const Interruptors = make<Array<Deferred<never, void>>>(() => []);
