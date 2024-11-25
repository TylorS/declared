import * as Cause from "@declared/cause";
import { Unexpected } from "@declared/cause";
import * as Context from "@declared/context";
import * as Disposable from "@declared/disposable";
import type { Duration } from "@declared/duration";
import * as Exit from "@declared/exit";
import * as Effect from "@declared/effect";
import * as Sink from "./sink.ts";
import * as Task from "./task.ts";
import { type Pipeable, pipeArguments } from "@declared/pipeable";

export interface Stream<out R, out E, out A> extends Pipeable {
  run<AdditionalResources = never>(
    sink: Sink.Sink<E, A>,
    runtime: Effect.Effect.Runtime<R | AdditionalResources>,
  ): Disposable | AsyncDisposable;
}

export function make<R, E, A>(run: Stream<R, E, A>["run"]): Stream<R, E, A> {
  return {
    run,
    pipe() {
      return pipeArguments(this, arguments);
    },
  };
}

export function of<const A>(value: A): Stream<never, never, A> {
  return make((sink, runtime) =>
    runtime.scheduler.asap(Task.propagateSingleton(sink, value))
  );
}

export function fromArray<const A extends ReadonlyArray<any>>(
  array: A,
): Stream<never, never, A[number]> {
  return make((sink, runtime) =>
    runtime.scheduler.asap(
      Task.andThen(Task.propagateArray(sink, array), () => sink.end()),
    )
  );
}

export function fromIterable<A>(
  iterable: Iterable<A>,
): Stream<never, never, A> {
  return make((sink, runtime) =>
    runtime.scheduler.asap(
      Task.andThen(Task.propagateIterable(sink, iterable), () => sink.end()),
    )
  );
}

export function failCause<E>(cause: Cause.Cause<E>): Stream<never, E, never> {
  return make((sink, runtime) =>
    runtime.scheduler.asap(Task.propagateError(sink, cause))
  );
}

export function delay(duration: Duration) {
  return <R, E, A>(
    stream: Stream<R, E, A>,
  ): Stream<R, E, A> => {
    return make((sink, runtime) => {
      const d = Disposable.settable();
      let pendingTasks = 0;
      let ended = false;

      d.add(stream.run(
        Sink.make(
          sink.error,
          (a) => {
            pendingTasks++;
            // deno-lint-ignore no-var
            var scheduledTask = d.add(runtime.scheduler.delay(
              Task.andThen(
                Task.propagateEvent(sink, a),
                () => {
                  scheduledTask && Disposable.syncDispose(scheduledTask);
                  pendingTasks--;
                  if (ended && pendingTasks === 0) {
                    sink.end();
                  }
                },
              ),
              duration,
            ));
          },
          () => {
            ended = true;
            if (pendingTasks === 0) {
              sink.end();
            }
          },
        ),
        runtime,
      ));

      return d;
    });
  };
}

export function periodic(duration: Duration): Stream<never, never, void> {
  return make((sink, runtime) =>
    runtime.scheduler.periodic(Task.propagateEvent(sink, undefined), duration)
  );
}

export function flatMap<A, R2, E2, B>(f: (a: A) => Stream<R2, E2, B>) {
  return <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
    make<R | R2, E | E2, B>((sink, runtime) => {
      const d = Disposable.settable();

      let outerEnded = false;
      let innerCount = 0;

      d.add(stream.run(
        Sink.make(
          sink.error,
          (value) => {
            const innerDisposable = d.extend();
            innerCount++;

            innerDisposable.add(
              f(value).run(
                Sink.make(sink.error, sink.event, () => {
                  if (--innerCount === 0 && outerEnded) {
                    sink.end();
                  }
                }),
                runtime,
              ),
            );
          },
          () => {
            outerEnded = true;

            if (innerCount === 0) {
              sink.end();
            }
          },
        ),
        runtime,
      ));

      return d;
    });
}

export function switchMap<A, R2, E2, B>(f: (a: A) => Stream<R2, E2, B>) {
  return <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
    make<R | R2, E | E2, B>((sink, runtime) => {
      const d = Disposable.settable();
      let outerEnded = false;
      let innerDisposable: Disposable.Settable | null = null;

      const onEvent = (a: A) => {
        // Create new inner stream
        const disposable = innerDisposable = d.extend();

        disposable.add(
          f(a).run(
            Sink.make(
              sink.error,
              sink.event,
              () => {
                Disposable.dispose(disposable).then(
                  () => {
                    if (disposable === innerDisposable) {
                      innerDisposable = null;
                    }

                    if (outerEnded) {
                      sink.end();
                    }
                  },
                  (u) => sink.error(new Unexpected(u)),
                );
              },
            ),
            runtime,
          ),
        );
      };

      d.add(stream.run(
        Sink.make(
          sink.error,
          (value) => {
            if (innerDisposable !== null) {
              return Disposable.dispose(innerDisposable).then(
                () => onEvent(value),
                (u) => sink.error(new Unexpected(u)),
              );
            }

            onEvent(value);
          },
          () => {
            outerEnded = true;
            if (innerDisposable === null) {
              sink.end();
            }
          },
        ),
        runtime,
      ));

      return d;
    });
}

export function exhaustMap<A, R2, E2, B>(f: (a: A) => Stream<R2, E2, B>) {
  return <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
    make<R | R2, E | E2, B>((sink, runtime) => {
      const d = Disposable.settable();
      let outerEnded = false;
      let innerDisposable: Disposable.Settable | null = null;

      const startInnerStream = (value: A) => {
        const disposable = innerDisposable = d.extend();

        disposable.add(
          f(value).run(
            Sink.make(
              sink.error,
              sink.event,
              () => {
                Disposable.dispose(disposable).then(
                  () => {
                    if (disposable === innerDisposable) {
                      innerDisposable = null;
                      if (outerEnded) {
                        sink.end();
                      }
                    }
                  },
                  (u) => sink.error(new Unexpected(u)),
                );
              },
            ),
            runtime,
          ),
        );
      };

      d.add(stream.run(
        Sink.make(
          sink.error,
          (value) => {
            if (innerDisposable !== null) {
              return;
            }

            startInnerStream(value);
          },
          () => {
            outerEnded = true;
            if (innerDisposable === null) {
              sink.end();
            }
          },
        ),
        runtime,
      ));

      return d;
    });
}

export function exhaustLatestMap<A, R2, E2, B>(f: (a: A) => Stream<R2, E2, B>) {
  return <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
    make<R | R2, E | E2, B>((sink, runtime) => {
      const d = Disposable.settable();
      let outerEnded = false;
      let innerDisposable: Disposable.Settable | null = null;
      let latestValue: { value: A } | null = null;

      const startInnerStream = (value: A) => {
        const disposable = innerDisposable = d.extend();

        disposable.add(
          f(value).run(
            Sink.make(
              sink.error,
              sink.event,
              () => {
                Disposable.dispose(disposable).then(
                  () => {
                    if (disposable === innerDisposable) {
                      innerDisposable = null;
                      // Only process latest value if this was the most recent inner stream
                      if (latestValue !== null) {
                        const valueToReplay = latestValue.value;
                        latestValue = null;
                        startInnerStream(valueToReplay);
                      } else if (outerEnded) {
                        sink.end();
                      }
                    }
                  },
                  (u) => sink.error(new Unexpected(u)),
                );
              },
            ),
            runtime,
          ),
        );
      };

      d.add(stream.run(
        Sink.make(
          sink.error,
          (value) => {
            if (innerDisposable !== null) {
              // Store the latest value while inner stream is active
              latestValue = { value };
              return;
            }

            startInnerStream(value);
          },
          () => {
            outerEnded = true;
            if (innerDisposable === null) {
              sink.end();
            }
          },
        ),
        runtime,
      ));

      return d;
    });
}

class FlatMapConcurrently<R, E, A, R2, E2, B>
  implements Stream<R | R2, E | E2, B> {
  constructor(
    readonly stream: Stream<R, E, A>,
    readonly f: (a: A) => Stream<R2, E2, B>,
    readonly concurrency: number,
  ) {}

  run(sink: Sink.Sink<E | E2, B>, runtime: Effect.Effect.Runtime<R | R2>) {
    const scope = runtime.scope.extend();
    const innerRuntime = { ...runtime, scope };
    const waiting: Array<Stream<R2, E2, B>> = [];
    let running = 0;
    let outerEnded = false;

    const runStream = (stream: Stream<R2, E2, B>) => {
      if (running >= this.concurrency) {
        waiting.push(stream);
        return;
      }

      running++;

      const inner = scope.extend();

      inner.addDisposable(Disposable.sync(() => {
        running--;
        if (outerEnded && running === 0 && waiting.length === 0) {
          sink.end();
        } else if (waiting.length > 0) {
          runStream(waiting.shift()!);
        }
      }));

      inner.addDisposable(
        stream.run(
          Sink.make(
            sink.error,
            sink.event,
            () => {
              return inner.close(Exit.void).run(innerRuntime);
            },
          ),
          { ...runtime, scope: inner },
        ),
      );

      return inner;
    };

    scope.addDisposable(this.stream.run(
      Sink.make(
        sink.error,
        (value) => {
          runStream(this.f(value));
        },
        () => {
          outerEnded = true;
          if (running === 0) {
            sink.end();
          }
        },
      ),
      innerRuntime,
    ));

    return Disposable.async(() =>
      scope.close(Exit.interrupted()).run(innerRuntime)
    );
  }

  pipe() {
    return pipeArguments(this, arguments);
  }
}

export const flatMapConcurrently =
  <A, R2, E2, B>(f: (a: A) => Stream<R2, E2, B>, concurrency: number) =>
  <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
    new FlatMapConcurrently(stream, f, concurrency);

export interface StreamFiber<E> extends AsyncDisposable {
  readonly exit: Promise<Exit.Exit<E, void>>;
}

const constVoid = () => undefined;

export function makeRunFork<R>(
  runtime: Effect.Effect.Runtime<R>,
) {
  return <E, A>(stream: Stream<R, E, A>): StreamFiber<E> => {
    const { promise, resolve } = Promise.withResolvers<Exit.Exit<E, void>>();
    const d = Disposable.settable();

    const onExit = (exit: Exit.Exit<E, void>) =>
      Disposable.dispose(d).then(
        () => resolve(exit),
        (u) =>
          resolve(exit.pipe(Exit.appendCause<never>(new Cause.Unexpected(u)))),
      );

    d.add(stream.run(
      Sink.make(
        (cause) => onExit(new Exit.Failure(cause)),
        constVoid,
        () => onExit(Exit.void),
      ),
      runtime,
    ));

    return {
      exit: promise,
      [Symbol.asyncDispose]: () => Disposable.dispose(d),
    };
  };
}

export function makeToArray<R>(
  runtime: Effect.Effect.Runtime<R>,
) {
  return <E, A>(stream: Stream<R, E, A>): Promise<A[]> => {
    const events: A[] = [];
    const { promise, resolve, reject } = Promise.withResolvers<A[]>();
    const onExit = (exit: Exit.Exit<E, void>) =>
      exit._id === "Failure" ? reject(exit.cause) : resolve(events);

    const d = stream.run(
      Sink.make(
        (cause) => onExit(new Exit.Failure(cause)),
        (a) => events.push(a),
        () => onExit(Exit.void),
      ),
      runtime,
    );

    return promise.finally(() => Disposable.dispose(d));
  };
}

export const runFork: <E, A>(stream: Stream<never, E, A>) => StreamFiber<E> =
  makeRunFork(Effect.defaultRuntime);

export const runExit: <E, A>(
  stream: Stream<never, E, A>,
) => Promise<Exit.Exit<E, void>> = (stream) => runFork(stream).exit;

export const run: <E, A>(stream: Stream<never, E, A>) => Promise<void> = (
  stream,
) =>
  runExit(stream).then((exit) =>
    exit._id === "Failure" ? Promise.reject(exit.cause) : undefined
  );

export const toArray: <E, A>(stream: Stream<never, E, A>) => Promise<A[]> =
  makeToArray(Effect.defaultRuntime);

export const provideContext = <R2>(provided: Context.Context<R2>) =>
<R, E, A>(
  stream: Stream<R, E, A>,
): Stream<Exclude<R, R2>, E, A> =>
  make((sink, runtime) =>
    stream.run(
      sink,
      {
        ...runtime,
        context: runtime.context.pipe(
          Context.merge(provided),
        ) as Context.Context<R>,
      },
    )
  );

export const fromEffect = <R, E, A>(
  effect: Effect.Effect<R, E, A>,
): Stream<R, E, A> =>
  make((sink, runtime) => {
    const fiber = effect.pipe(
      Effect.matchCause(
        (cause) => Effect.sync(() => sink.error(cause)),
        (value) =>
          Effect.sync(() => {
            sink.event(value);
            sink.end();
          }),
      ),
      Effect.makeRunFork(runtime),
    );
    return fiber;
  });

export const mapEffect =
  <R, E, A, R2, E2, B>(f: (a: A) => Effect.Effect<R2, E2, B>) =>
  (stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
    stream.pipe(flatMap((a) => fromEffect(f(a))));
