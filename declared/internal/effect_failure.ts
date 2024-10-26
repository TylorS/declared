import type { Cause } from "../mod.ts";
import { stringify } from "./stringify.ts";

export class EffectFailure<E> extends Error {
  constructor(override readonly cause: Cause.Cause<E>) {
    super(stringify(cause));
  }
}
