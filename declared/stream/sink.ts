import type { Cause } from "@declared/cause";

export interface Sink<E, A> {
  event(value: A): void;
  error(cause: Cause<E>): void;
  end(): void;
}

export function make<E, A>(
  error: (cause: Cause<E>) => void,
  event: (value: A) => void,
  end: () => void,
): Sink<E, A> {
  return {
    event,
    error,
    end,
  };
}
