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

export const isLeft = <E, S>(either: Either<E, S>): either is Left<E> =>
  either._id === Left._id;

export const isRight = <E, S>(either: Either<E, S>): either is Right<S> =>
  either._id === Right._id;

export const map =
  <E, A, B>(f: (a: A) => B) => (either: Either<E, A>): Either<E, B> =>
    isLeft(either) ? either : new Right(f(either.value));

export const match =
  <E, A, B>(onLeft: (e: E) => B, onRight: (a: A) => B) =>
  (either: Either<E, A>): B =>
    isLeft(either) ? onLeft(either.cause) : onRight(either.value);

export const flatMap =
  <E, A, B>(f: (a: A) => Either<E, B>) =>
  (either: Either<E, A>): Either<E, B> =>
    isLeft(either) ? either : f(either.value);
