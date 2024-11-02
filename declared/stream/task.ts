import { type Cause, Sequential, Unexpected } from "@declared/cause";
import type { Sink } from "./sink.ts";

export interface Task {
  run(): void;
  error(error: unknown): void;
}

export function propagateSingleton<E, A>(sink: Sink<E, A>, value: A): Task {
  return {
    run() {
      sink.event(value);
      sink.end();
    },
    error(u) {
      sink.error(new Unexpected(u));
    },
  };
}

export function propagateEvent<E, A>(sink: Sink<E, A>, value: A): Task {
  return {
    run() {
      sink.event(value);
    },
    error(u) {
      sink.error(new Unexpected(u));
    },
  };
}

export function propagateError<E, A>(sink: Sink<E, A>, cause: Cause<E>): Task {
  return {
    run() {
      sink.error(cause);
    },
    error(u) {
      try {
        sink.error(new Sequential([cause, new Unexpected(u)]));
      } catch (error) {
        console.error(
          `Failed to propagate failure due to another failure occuring`,
          error,
        );
      }
    },
  };
}

export function propagateEnd<E, A>(sink: Sink<E, A>): Task {
  return {
    run() {
      sink.end();
    },
    error(u) {
      sink.error(new Unexpected(u));
    },
  };
}

export function propagateArray<E, A>(
  sink: Sink<E, A>,
  array: ArrayLike<A>,
): Task {
  return {
    run() {
      for (let i = 0; i < array.length; ++i) {
        sink.event(array[i]);
      }
    },
    error(u) {
      sink.error(new Unexpected(u));
    },
  };
}

export function propagateIterable<E, A>(
  sink: Sink<E, A>,
  iterable: Iterable<A>,
): Task {
  return {
    run() {
      for (const value of iterable) {
        sink.event(value);
      }
    },
    error(u) {
      sink.error(new Unexpected(u));
    },
  };
}

export function andThen(task: Task, f: () => void): Task {
  return {
    run() {
      task.run();
      f();
    },
    error(u: unknown) {
      task.error(u);
    },
  };
}
