import { Exit } from "@declared/exit";

export interface Deferred<E, A>
  extends ReturnType<typeof Promise.withResolvers<Exit<E, A>>> {}

export const make = <E, A>(): Deferred<E, A> =>
  Promise.withResolvers<Exit<E, A>>();
