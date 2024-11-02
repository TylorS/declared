import type { Context } from "@declared/context";
import * as Disposable from "@declared/disposable";
import type { Duration } from "@declared/duration";
import type { Scheduler } from "./scheduler.ts";
import * as Sink from "./sink.ts";
import * as Task from "./task.ts";

export interface Stream<out R, out E, out A> {
  run<R2>(
    sink: Sink.Sink<E, A>,
    scheduler: Scheduler,
    context: Context<R | R2>,
  ): Disposable | AsyncDisposable;
}

export function make<R, E, A>(run: Stream<R, E, A>["run"]): Stream<R, E, A> {
  return {
    run,
  };
}

export function of<const A>(value: A): Stream<never, never, A> {
  return make((sink, scheduler) =>
    scheduler.asap(Task.propagateSingleton(sink, value))
  );
}

export function fromArray<const A extends ReadonlyArray<any>>(
  array: A,
): Stream<never, never, A[number]> {
  return make((sink, scheduler) =>
    scheduler.asap(
      Task.andThen(Task.propagateArray(sink, array), () => sink.end()),
    )
  );
}

export function fromIterable<A>(
  iterable: Iterable<A>,
): Stream<never, never, A> {
  return make((sink, scheduler) =>
    scheduler.asap(
      Task.andThen(Task.propagateIterable(sink, iterable), () => sink.end()),
    )
  );
}

export function delay(duration: Duration) {
  return <R, E, A>(
    stream: Stream<R, E, A>,
  ): Stream<R, E, A> => {
    return make((sink, scheduler, ctx) => {
      const d = Disposable.settable();

      d.add(stream.run(
        Sink.make(
          sink.error,
          (a) => {
            // deno-lint-ignore no-var
            var scheduledTask = d.add(scheduler.delay(
              Task.andThen(
                Task.propagateEvent(sink, a),
                () => scheduledTask && Disposable.syncDispose(scheduledTask),
              ),
              duration,
            ));
          },
          sink.end,
        ),
        scheduler,
        ctx,
      ));

      return d;
    });
  };
}

export function periodic(duration: Duration): Stream<never, never, void> {
  return make((sink, scheduler) =>
    scheduler.periodic(Task.propagateEvent(sink, undefined), duration)
  );
}

export function flatMap<A, R2, E2, B>(f: (a: A) => Stream<R2, E2, B>) {
  return <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
    make<R | R2, E | E2, B>((sink, scheduler, ctx) => {
      const d = Disposable.settable();

      d.add(stream.run(
        Sink.make(
          (cause) => {},
          (value) => {},
          () => {},
        ),
        scheduler,
        ctx,
      ));

      return d;
    });
}
