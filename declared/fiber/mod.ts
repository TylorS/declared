import type { Effect } from "@declared/effect";
import type { Exit } from "@declared/exit";

export interface Fiber<E, A>
  extends Effect<never, E, A>, AsyncDisposable, PromiseLike<Exit<E, A>> {
}
