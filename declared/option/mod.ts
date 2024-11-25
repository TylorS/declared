import * as AsyncIterable from "@declared/async_iterable";

export type Option<Value> = Some<Value> | None;

export class Some<out Value> extends AsyncIterable.Yieldable("Some")<Value> {
  constructor(readonly value: Value) {
    super();
  }
}

export class None extends AsyncIterable.Failure("None") {}

export const some = <Value>(value: Value): Some<Value> => new Some(value);

export const none = (): None => new None();

export const isSome = <Value>(option: Option<Value>): option is Some<Value> =>
  option._id === Some._id;

export const isNone = <Value>(option: Option<Value>): option is None =>
  option._id === None._id;

export const match = <A, B>(
  onNone: () => B,
  onSome: (value: A) => B,
) =>
(option: Option<A>): B => isNone(option) ? onNone() : onSome(option.value);

export const flatMap =
  <A, B>(f: (a: A) => Option<B>) => (option: Option<A>): Option<B> =>
    isNone(option) ? option : f(option.value);
