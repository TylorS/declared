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
