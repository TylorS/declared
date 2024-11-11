import * as AsyncIterable from "@declared/async_iterable";
import { Tag } from "@declared/tag";

export interface Scope extends AsyncDisposable {
  readonly _id: "Scope";

  add(disposable: Disposable | AsyncDisposable): Disposable;
  extend(): Scope;
}

export const Scope = Tag<Scope>("Scope");

const makeDisposable = (dispose: () => void) => ({
  [Symbol.dispose]: dispose,
});

class ScopeImpl implements Scope {
  readonly _id = "Scope";

  private disposables: Disposable[] = [];
  private asyncDisposables: AsyncDisposable[] = [];

  add(disposable: Disposable | AsyncDisposable): Disposable {
    if (isSyncDisposable(disposable)) {
      this.disposables.push(disposable);
      return makeDisposable(() => this.removeDisposable(disposable));
    } else {
      this.asyncDisposables.push(disposable);
      return makeDisposable(() => this.removeAsyncDisposable(disposable));
    }
  }

  private removeDisposable(disposable: Disposable): void {
    const index = this.disposables.indexOf(disposable);
    if (index !== -1) {
      this.disposables.splice(index, 1);
    }
  }

  private removeAsyncDisposable(disposable: AsyncDisposable): void {
    const index = this.asyncDisposables.indexOf(disposable);
    if (index !== -1) {
      this.asyncDisposables.splice(index, 1);
    }
  }

  extend(): Scope {
    const child = new ScopeImpl();
    child.add(this.add(child));
    return child;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.disposables.forEach((d) => d[Symbol.dispose]());

    await Promise.allSettled(
      this.asyncDisposables.map((d) => d[Symbol.asyncDispose]()),
    );
  }

  static readonly make = (): Scope => new ScopeImpl();
}

export function make(): Scope {
  return new ScopeImpl();
}

const isSyncDisposable = (
  disposable: Disposable | AsyncDisposable,
): disposable is Disposable => Reflect.has(disposable, Symbol.dispose);

export class GetScope extends AsyncIterable.Yieldable("GetScope")<Scope> {}
