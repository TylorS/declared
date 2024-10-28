import * as Cause from "@declared/cause";
import * as Exit from "@declared/exit";
import * as AsyncIterable from "@declared/async_iterable";

export type Data<Error, Output> =
  | NoData
  | Loading
  | Exit.Exit<Error, Output>
  | Retrying<Error>
  | Refreshing<Output>;

export class NoData extends AsyncIterable.Failure("NoData") {}
export const noData = (): NoData => new NoData();

export class Loading extends AsyncIterable.Failure("Loading") {}
export const loading = (): Loading => new Loading();

export class Retrying<E>
  extends AsyncIterable.Failure("Retrying")<Cause.Cause<E>> {
  constructor(override readonly cause: Cause.Cause<E>) {
    super(cause, { cause });
  }
}

export function retrying<const Error>(
  cause: Cause.Cause<Error>,
): Retrying<Error> {
  return new Retrying(cause);
}

export class Refreshing<Output>
  extends AsyncIterable.Yieldable("Refreshing")<Output> {
  constructor(readonly value: Output) {
    super();
  }
}

export function refreshing<const Output>(output: Output): Refreshing<Output> {
  return new Refreshing(output);
}

export const success = <const Output>(output: Output): Exit.Success<Output> =>
  new Exit.Success(output);

export const failure = <Error = never>(
  error: Cause.Cause<Error>,
): Exit.Failure<Error> => new Exit.Failure(error);

export const expected = <const Error>(error: Error): Exit.Failure<Error> =>
  failure(new Cause.Expected(error));

export const unexpected = <const Error>(error: Error): Exit.Failure<never> =>
  failure<never>(new Cause.Unexpected(error));
