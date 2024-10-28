import * as AsyncIterable from "../async_iterable/async_iterable.ts";

export type Either<Error, Success> = Left<Error> | Right<Success>;

export declare namespace Either {
  export type GetLeft<T> = [T] extends [never] ? never
    : T extends Left<infer E> ? E
    : never;

  export type GetRight<T> = [T] extends [never] ? never
    : T extends Right<infer S> ? S
    : never;
}

export class Left<const Error> extends AsyncIterable.Failure("Left")<Error> {}

export class Right<const Success>
  extends AsyncIterable.Yieldable(`Right`)<Success> {
  constructor(readonly value: Success) {
    super();
  }
}
