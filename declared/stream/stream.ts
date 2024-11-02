import type { Context } from "@declared/context";
import type { Scheduler } from "./scheduler.ts";
import type { Sink } from "./sink.ts";
import * as Task from "./task.ts";

export interface Stream<out R, out E, out A> {
  run(
    params: StreamRunParams<R, E, A>,
  ): Disposable | AsyncDisposable;
}

export interface StreamRunParams<R, E, A> {
  readonly context: Context<R>;
  readonly scheduler: Scheduler;
  readonly sink: Sink<E, A>;
}

export function make<R, E, A>(run: Stream<R, E, A>["run"]): Stream<R, E, A> {
  return {
    run,
  };
}

export function of<const A>(value: A): Stream<never, never, A> {
  return make(({ sink, scheduler }) =>
    scheduler.asap(Task.propagateSingleton(sink, value))
  );
}

export function fromArray<const A extends ReadonlyArray<any>>(
  array: A,
): Stream<never, never, A[number]> {
  return make(({ sink, scheduler }) =>
    scheduler.asap(
      Task.andThen(Task.propagateArray(sink, array), () => sink.end()),
    )
  );
}

export function fromIterable<A>(
  iterable: Iterable<A>,
): Stream<never, never, A> {
  return make(({ sink, scheduler }) =>
    scheduler.asap(
      Task.andThen(Task.propagateIterable(sink, iterable), () => sink.end()),
    )
  );
}
