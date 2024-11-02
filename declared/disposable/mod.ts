export const sync = (f: () => void): Disposable => ({
  [Symbol.dispose]: f,
});

export const async = (f: () => PromiseLike<void>): AsyncDisposable => ({
  [Symbol.asyncDispose]: f,
});

export const isSync = (d: Disposable | AsyncDisposable): d is Disposable =>
  Reflect.has(d, Symbol.dispose);

export const isAsync = (
  d: Disposable | AsyncDisposable,
): d is AsyncDisposable => Reflect.has(d, Symbol.asyncDispose);

export const syncDispose = (d: Disposable): void => d[Symbol.dispose]();

export const asyncDispose = (d: AsyncDisposable): PromiseLike<void> =>
  d[Symbol.asyncDispose]();

export const dispose = async (
  d: Disposable | AsyncDisposable,
): Promise<void> => {
  if (isSync(d)) {
    syncDispose(d);
  } else {
    await asyncDispose(d);
  }
};

export interface Settable extends AsyncDisposable {
  isDisposed(): boolean;
  add(disposable: Disposable | AsyncDisposable): Disposable;
  extend(): Settable;
}

export function settable(): Settable {
  let isDisposed: boolean = false;
  const disposables: Array<Disposable | AsyncDisposable> = [];

  function add(d: Disposable | AsyncDisposable) {
    disposables.push(d);
    return sync(() => {
      const i = disposables.indexOf(d);
      if (i > -1) {
        disposables.splice(i, 1);
      }
    });
  }

  return {
    isDisposed: () => isDisposed,
    add,
    extend() {
      const inner = settable();
      inner.add(add(inner));
      return inner;
    },
    async [Symbol.asyncDispose]() {
      if (isDisposed) return;

      isDisposed = true;

      for (let i = disposables.length - 1; i > -1; --i) {
        const d = disposables[i];
        if (isSync(d)) syncDispose(d);
        else await asyncDispose(d);
      }
    },
  };
}

export const none = sync(() => {});
