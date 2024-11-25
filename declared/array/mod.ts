import { Pipeable, pipeArguments } from "@declared/pipeable";

export type NonEmptyArray<A> = readonly [A, ...Array<A>];

export const isArray = (value: unknown): value is ReadonlyArray<unknown> =>
  Array.isArray(value);

export const isNonEmptyArray = <A>(
  value: ReadonlyArray<A>,
): value is NonEmptyArray<A> => value.length > 0;

export const map: {
  <A, B>(
    f: (a: A, index: number) => B,
  ): {
    (as: NonEmptyArray<A>): NonEmptyArray<B>;
    (as: ReadonlyArray<A>): ReadonlyArray<B>;
  };
} = <A, B>(
  f: (a: A, index: number) => B,
): (as: ReadonlyArray<A> | NonEmptyArray<A>) => NonEmptyArray<B> =>
(as) => as.map(f) as any;

export const flatMap: {
  <A, B>(
    f: (a: A, index: number) => NonEmptyArray<B>,
  ): {
    (as: NonEmptyArray<A>): NonEmptyArray<B>;
    (as: ReadonlyArray<A>): NonEmptyArray<B>;
  };

  <A, B>(
    f: (a: A, index: number) => ReadonlyArray<B>,
  ): {
    (as: NonEmptyArray<A>): NonEmptyArray<B>;
    (as: ReadonlyArray<A>): ReadonlyArray<B>;
  };
} = <A, B>(f: (a: A, index: number) => ReadonlyArray<B> | NonEmptyArray<B>) =>
(
  as: ReadonlyArray<A> | NonEmptyArray<A>,
): NonEmptyArray<B> => as.flatMap(f) as any;

declare global {
  interface Array<T> extends Pipeable {}
}

Array.prototype.pipe = function pipe(this: Array<unknown>) {
  return pipeArguments(this, arguments);
};
