import type { Cause } from "@declared/cause";

export interface Sink<E, A> {
  event(value: A): void;
  error(cause: Cause<E>): void;
  end(): void;
}
