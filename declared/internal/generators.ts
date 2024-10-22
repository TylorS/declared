export class ThisIterable<O> {
  readonly [Symbol.iterator] = () => new OnceIterator<this, O>(this);
}

export class OnceIterator<I, O> implements Iterator<I, O> {
  private done = false;
  constructor(private readonly value: I) {}

  next(...[value]: [] | [any]): IteratorResult<I, O> {
    if (this.done) {
      return { value, done: true };
    }

    this.done = true;
    return { value: this.value, done: false };
  }
}
