import { type Pipeable, pipeArguments } from "../pipeable/mod.ts";

export class ThisIterable<out O> implements Pipeable {
  [Symbol.asyncIterator](): AsyncIterator<this, O> {
    return new OnceIterator<this, O>(this);
  }

  pipe() {
    return pipeArguments(this, arguments);
  }
}

export class OnceIterator<I, O> implements AsyncIterator<I, O> {
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

  [Symbol.asyncIterator](): AsyncIterator<this, never> {
    return new OnceIterator(this);
  }

  override pipe() {
    return pipeArguments(this, arguments);
  }
}

export class AggregateErrorIterable extends AggregateError implements Pipeable {
  constructor(errors: Array<any>, message?: string, options?: ErrorOptions) {
    super(errors, message, options);
  }

  [Symbol.asyncIterator](): AsyncIterator<this, never> {
    return new OnceIterator(this);
  }

  override pipe() {
    return pipeArguments(this, arguments);
  }
}

export class MapIterable<I, O, O2> implements Pipeable {
  constructor(
    readonly iterable: {
      [Symbol.asyncIterator]: () => AsyncIterator<I, O>;
    },
    readonly map: (value: O) => O2,
  ) {}

  [Symbol.asyncIterator](): AsyncIterator<I, O2> {
    return new MapIterator(this.iterable[Symbol.asyncIterator](), this.map);
  }

  pipe() {
    return pipeArguments(this, arguments);
  }
}

export class MapIterator<I, O, O2> implements AsyncIterator<I, O2> {
  constructor(
    readonly iterator: AsyncIterator<I, O>,
    readonly map: (value: O) => O2,
  ) {}

  next(...[value]: [] | [any]): Promise<IteratorResult<I, O2>> {
    return this.mapResult(this.iterator.next(value));
  }

  throw(exception: unknown): Promise<IteratorResult<I, O2>> {
    if (this.iterator.throw) {
      return this.mapResult(this.iterator.throw(exception));
    }

    return Promise.reject(exception);
  }

  return(value: any): Promise<IteratorResult<I, O2>> {
    if (this.iterator.return) {
      return this.mapResult(this.iterator.return(value));
    }

    return Promise.resolve({ value: this.map(value), done: true });
  }

  private mapResult(
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
