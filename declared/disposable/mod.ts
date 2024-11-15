export const sync = (f: () => unknown): Disposable => ({
  [Symbol.dispose]: f,
});

export const async = (f: () => PromiseLike<unknown>): AsyncDisposable => ({
  [Symbol.asyncDispose]: f as () => PromiseLike<void>,
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

const CANNOT_EXTEND_DISPOSED_ERROR = "Cannot extend a disposed Disposable.\n" +
  "This error occurs when trying to extend a Disposable that has already been disposed.\n" +
  "To fix this:\n" +
  "1. Check if the Disposable is disposed before extending it using .isDisposed()\n" +
  "2. Only extend Disposables that are still active\n" +
  "3. Create a new Disposable if you need one after the original is disposed\n" +
  "\nFor more details, see the Disposable documentation.";

const CANNOT_ADD_DISPOSED_ERROR = "Cannot add a disposed Disposable.\n" +
  "This error occurs when trying to add a Disposable that has already been disposed.\n" +
  "To fix this:\n" +
  "1. Check if the Disposable is disposed before adding it using .isDisposed()\n" +
  "2. Only add Disposables that are still active\n" +
  "3. Create a new Disposable if you need one after the original is disposed\n" +
  "\nFor more details, see the Disposable documentation.";

export function settable(): Settable {
  let isDisposed: boolean = false;
  const disposables: Array<Disposable | AsyncDisposable> = [];

  function add(d: Disposable | AsyncDisposable) {
    if (isDisposed) {
      throw new Error(CANNOT_ADD_DISPOSED_ERROR);
    }

    if (d === none) return d;

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
      if (isDisposed) {
        throw new Error(CANNOT_EXTEND_DISPOSED_ERROR);
      }

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
