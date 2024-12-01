import type { Effect } from "@declared/effect";
import type { Exit } from "@declared/exit";

export interface Fiber<E, A> extends Effect<never, E, A>, AsyncDisposable {
  readonly exit: Promise<Exit<E, A>>;
  readonly interrupt: Effect<never, never, Exit<E, A>>;
}
