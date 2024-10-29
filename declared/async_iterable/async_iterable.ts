import { type Pipeable, pipeArguments } from "../pipeable/mod.ts";
import {
  AggregateErrorIterable,
  ErrorIterable,
  ThisIterable,
} from "../internal/generators.ts";
import { stringify } from "../internal/stringify.ts";

export interface AsyncIterable<Yield, Return> extends Pipeable {
  readonly [Symbol.asyncIterator]: () => AsyncIterator<
    Yield,
    Return
  >;
}

class Proto implements Pipeable {
  pipe() {
    return pipeArguments(this, arguments);
  }
}

export function make<Yield, Return>(
  f: () => AsyncIterator<Yield, Return>,
): AsyncIterable<Yield, Return> {
  const iterable = Object.create(Proto.prototype);
  iterable[Symbol.asyncIterator] = f;
  return iterable;
}

export function iterator<Yield, Return>(
  iterable: globalThis.AsyncIterable<Yield, Return>,
): AsyncIterator<Yield, Return> {
  return iterable[Symbol.asyncIterator]();
}

export type AnyIdObject = {
  readonly _id: string;
};

export const Yieldable = <const Id extends string>(id: Id) =>
  class Yieldable<T> extends ThisIterable<T> implements Pipeable {
    static readonly _id: Id = id;
    readonly _id: Id = id;
    override readonly pipe: Pipeable["pipe"] = super.pipe;
  };

export const Failure = <const Id extends string>(id: Id) =>
  class<E = void> extends ErrorIterable implements Pipeable {
    static readonly _id: Id = id;
    readonly _id: Id = id;
    override readonly pipe: Pipeable["pipe"] = super.pipe;
    override readonly name = id;

    constructor(
      override readonly cause: E,
      options?: ErrorOptions & { message?: string },
    ) {
      super(options?.message ?? stringify(cause), options);
    }
  };

export const AggregateFailure = <const Id extends string>(id: Id) =>
  class<E extends Iterable<any>> extends AggregateErrorIterable
    implements Pipeable {
    static readonly _id: Id = id;
    readonly _id: Id = id;
    override readonly pipe: Pipeable["pipe"] = super.pipe;

    constructor(
      errors: E,
      options?: ErrorOptions & { message?: string },
    ) {
      super(
        Array.from(errors),
        options?.message ?? "AggregateFailure",
        options,
      );
    }
  };

export function run<Return>(
  iterable: AsyncIterable<never, Return>,
): Promise<Return> {
  return iterator(iterable).next().then((result) => result.value);
}

export const map = <A, B>(
  f: (a: A) => B,
) =>
<Yield>(
  iterable: AsyncIterable<Yield, A>,
): AsyncIterable<Yield, B> =>
  make(async function* () {
    const i = iterator(iterable);
    let result = await i.next();
    while (!result.done) {
      result = await i.next(yield result.value);
    }
    return f(result.value);
  });
