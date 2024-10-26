import { type Pipeable, pipeArguments } from "@declared/pipeable";
import type { Effect } from "../effect/effect.ts";
import type { Cause } from "@declared/cause";

export class ThisIterable<out O> implements Pipeable {
  [Symbol.asyncIterator](): Effect.Iterator<this, O> {
    return new OnceIterator<this, O>(this);
  }

  pipe() {
    return pipeArguments(this, arguments);
  }
}

export class OnceIterator<I, O> implements Effect.Iterator<I, O> {
  done = false;

  constructor(readonly value: I) {}

  next(...[value]: [] | [any]): Promise<IteratorResult<I, O>> {
    if (this.done) {
      return Promise.resolve({ value, done: true });
    }

    this.done = true;
    return Promise.resolve({ value: this.value, done: false });
  }

  return(value: any): Promise<IteratorResult<I, O>> {
    this.done = true;
    return Promise.resolve({ value, done: true });
  }

  throw(exception: unknown): Promise<IteratorResult<I, O>> {
    this.done = true;
    return Promise.reject(exception);
  }
}

export class ErrorIterable extends Error implements Pipeable {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
  }

  [Symbol.asyncIterator](): Effect.Iterator<this, never> {
    return new OnceIterator(this);
  }

  pipe() {
    return pipeArguments(this, arguments);
  }
}

export class AsCauseIterable<Self> extends Error implements Pipeable {
  constructor(
    readonly map: (error: Self) => Cause<Self>,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }

  [Symbol.asyncIterator](): Effect.Iterator<Cause<Self>, never> {
    return new OnceIterator(this.map(this as unknown as Self));
  }

  pipe() {
    return pipeArguments(this, arguments);
  }
}

export class MapIterable<I, O, O2> implements Pipeable {
  constructor(
    readonly iterable: {
      [Symbol.asyncIterator]: () => Effect.Iterator<I, O>;
    },
    readonly map: (value: O) => O2,
  ) {}

  [Symbol.asyncIterator](): Effect.Iterator<I, O2> {
    return new MapIterator(this.iterable[Symbol.asyncIterator](), this.map);
  }

  pipe() {
    return pipeArguments(this, arguments);
  }
}

export class MapIterator<I, O, O2> implements Effect.Iterator<I, O2> {
  constructor(
    readonly iterator: Effect.Iterator<I, O>,
    readonly map: (value: O) => O2,
  ) {}

  next(...[value]: [] | [any]): Promise<IteratorResult<I, O2>> {
    return this.mapResult(this.iterator.next(value));
  }

  throw(exception: unknown): Promise<IteratorResult<I, O2>> {
    return this.mapResult(this.iterator.throw(exception));
  }

  return(value: any): Promise<IteratorResult<I, O2>> {
    return this.mapResult(this.iterator.return(value));
  }

  mapResult(
    result: Promise<IteratorResult<I, O>>,
  ): Promise<IteratorResult<I, O2>> {
    return result.then((result) => {
      if (result.done) {
        return {
          value: this.map(result.value),
          done: true,
        };
      }

      return result;
    });
  }
}
