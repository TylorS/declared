import * as AsyncIterable from "@declared/async_iterable";
import { settable, sync } from "@declared/disposable";
import * as Effect from "@declared/effect";
import { Exit } from "@declared/exit";
import { Tag } from "@declared/tag";

export type Finalizer<R = never> = (
  exit: Exit<unknown, unknown>,
) => Effect.Effect<R, never, unknown>;

export interface Scope {
  readonly _id: "Scope";

  addFinalizer<R>(finalizer: Finalizer<R>): Effect.Effect<R, never, Disposable>;
  addDisposable(disposable: Disposable | AsyncDisposable): Disposable;
  extend(): Scope;
  close(exit: Exit<unknown, unknown>): Effect.Effect<never, never, unknown>;
}

export const Scope = Tag<Scope>("Scope");

class ScopeImpl implements Scope {
  readonly _id = "Scope";

  private finalizers: Set<Finalizer> = new Set();
  private disposable = settable();

  addDisposable(disposable: Disposable | AsyncDisposable): Disposable {
    return this.disposable.add(disposable);
  }

  extend(): Scope {
    const child = new ScopeImpl();
    const close = (exit: Exit<unknown, unknown>) => child.close(exit);
    this.finalizers.add(close);
    child.addDisposable(sync(() => this.finalizers.delete(close)));
    return child;
  }

  addFinalizer<R>(
    finalizer: Finalizer<R>,
  ): Effect.Effect<R, never, Disposable> {
    return Effect.gen(this, async function* () {
      const ctx = yield* Effect.context<R>();
      const close = (exit: Exit<unknown, unknown>) =>
        finalizer(exit).pipe(Effect.provideContext(ctx));
      this.finalizers.add(close);
      return this.addDisposable(sync(() => this.finalizers.delete(close)));
    });
  }

  close(exit: Exit<unknown, unknown>): Effect.Effect<never, never, unknown> {
    return Effect.gen(this, async function* () {
      const finalizers = Array.from(this.finalizers).reverse();
      this.finalizers.clear();
      for (const finalizer of finalizers) {
        yield* finalizer(exit).pipe(Effect.exit);
      }
      await this.disposable[Symbol.asyncDispose]();
    });
  }

  static readonly make = (): Scope => new ScopeImpl();
}

export function make(): Scope {
  return new ScopeImpl();
}

export class GetScope extends AsyncIterable.Yieldable("GetScope")<Scope> {}
