import * as AsyncIterable from "@declared/async_iterable";
import * as Cause from "@declared/cause";

export type Exit<Error, Output> = Failure<Error> | Success<Output>;

export declare namespace Exit {
  export type GetError<Exit> = [Exit] extends [Failure<infer Error>] ? Error
    : never;

  export type GetOutput<Exit> = [Exit] extends [Success<infer Output>] ? Output
    : never;
}

export class Failure<const out Error>
  extends AsyncIterable.Failure("Failure")<Cause.Cause<Error>> {}

export class Success<const out Output>
  extends AsyncIterable.Yieldable("Success")<Output> {
  constructor(readonly value: Output) {
    super();
  }
}

const void_ = new Success<void>(undefined);
const null_ = new Success<null>(null);

export { null_ as null, void_ as void };

export function appendCause<E2>(cause: Cause.Cause<E2>) {
  return <E, A>(exit: Exit<E, A>): Exit<E | E2, A> => {
    if (exit._id === "Success") return new Failure(cause);

    return new Failure(
      new Cause.Sequential<E | E2>([exit.cause, cause]),
    );
  };
}

export const success = <A>(value: A): Exit<never, A> => new Success(value);

export const failure = <E>(cause: Cause.Cause<E>): Exit<E, never> =>
  new Failure(cause);

export const unexpected = (unexpected: unknown): Exit<never, never> =>
  failure<never>(
    unexpected instanceof Cause.Interrupted ||
      unexpected instanceof Cause.Unexpected ||
      unexpected instanceof Cause.Empty
      ? unexpected
      : new Cause.Unexpected(unexpected),
  );

export const empty = () => failure<never>(new Cause.Empty());

export const expected = <E>(expected: E): Exit<E, never> =>
  failure<E>(new Cause.Expected(expected));

export const isFailure = <E, A>(exit: Exit<E, A>): exit is Failure<E> =>
  exit._id === Failure._id;

export const isInterrupted = <E, A>(exit: Exit<E, A>): exit is Failure<never> =>
  exit._id === Failure._id && exit.cause._id === "Interrupted";

export const isSuccess = <E, A>(exit: Exit<E, A>): exit is Success<A> =>
  exit._id === Success._id;

export const map =
  <A, B>(f: (a: A) => B) => <E>(exit: Exit<E, A>): Exit<E, B> =>
    isSuccess(exit) ? success(f(exit.value)) : exit;

export const interrupted = () => failure<never>(new Cause.Interrupted());

export const flatMap =
  <E2, A, B>(f: (a: A) => Exit<E2, B>) =>
  <E>(exit: Exit<E, A>): Exit<E | E2, B> =>
    isSuccess(exit) ? f(exit.value) : exit;

export const match =
  <E, A, B, C>(onError: (e: Cause.Cause<E>) => B, onSuccess: (a: A) => C) =>
  (exit: Exit<E, A>): B | C =>
    isSuccess(exit) ? onSuccess(exit.value) : onError(exit.cause);
