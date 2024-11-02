import * as AsyncIterable from "@declared/async_iterable";
import * as Cause from "@declared/cause";

export type Exit<Error, Output> = Failure<Error> | Success<Output>;

export declare namespace Exit {
  export type GetError<Exit> = [Exit] extends [Failure<infer Error>] ? Error
    : never;

  export type GetOutput<Exit> = [Exit] extends [Success<infer Output>] ? Output
    : never;
}

export class Failure<const Error>
  extends AsyncIterable.Failure("Failure")<Cause.Cause<Error>> {}

export class Success<const Output>
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
