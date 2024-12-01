import * as Cause from "@declared/cause";
import { Unexpected } from "@declared/cause";
import * as Context from "@declared/context";
import * as Disposable from "@declared/disposable";
import type { Duration } from "@declared/duration";
import * as Effect from "@declared/effect";
import * as Exit from "@declared/exit";
import { type Pipeable, pipeArguments } from "@declared/pipeable";
import * as Scope from "@declared/scope";
import * as Sink from "./sink.ts";
import * as Task from "./task.ts";

export abstract class Stream<out R, out E, out A> implements Pipeable {
  abstract run<AdditionalResources = never>(
    sink: Sink.Sink<E, A>,
    runtime: Effect.Effect.Runtime<R | AdditionalResources>,
  ): Disposable | AsyncDisposable;

  pipe: Pipeable["pipe"] = function pipe<T>(this: T) {
    return pipeArguments(this, arguments);
  };
}

class Make<R, E, A> extends Stream<R, E, A> {
  constructor(readonly run: Stream<R, E, A>["run"]) {
    super();
  }
}

export function make<R, E, A>(run: Stream<R, E, A>["run"]): Stream<R, E, A> {
  return new Make(run);
}

class Of<const A> extends Stream<never, never, A> {
  constructor(readonly value: A) {
    super();
  }

  run<AdditionalResources>(
    sink: Sink.Sink<never, A>,
    runtime: Effect.Effect.Runtime<AdditionalResources>,
  ) {
    return runtime.scheduler.asap(Task.propagateSingleton(sink, this.value));
  }
}

export function of<const A>(value: A): Stream<never, never, A> {
  return new Of(value);
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

export function failure<E>(cause: Cause.Cause<E>): Stream<never, E, never> {
  return make((sink, runtime) =>
    runtime.scheduler.asap(
      Task.andThen(Task.propagateError(sink, cause), () => sink.end()),
    )
  );
}

export function expected<E>(error: E): Stream<never, E, never> {
  return failure(Cause.expected(error));
}

export function unexpected(error: unknown): Stream<never, never, never> {
  return failure(Cause.unexpected(error));
}

export function never(): Stream<never, never, never> {
  return make(() => Disposable.none);
}

export function empty(): Stream<never, never, never> {
  return make((sink, { scheduler }) => scheduler.asap(Task.propagateEnd(sink)));
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
  extends Stream<R | R2, E | E2, B> {
  constructor(
    readonly stream: Stream<R, E, A>,
    readonly f: (a: A) => Stream<R2, E2, B>,
    readonly concurrency: number,
  ) {
    super();
  }

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
            () => inner.close(Exit.void).run(innerRuntime),
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
    const scope = runtime.scope.extend();
    const innerRuntime = { ...runtime, scope };

    const onExit = (exit: Exit.Exit<E, void>) =>
      scope.close(exit).run(innerRuntime).then(
        () => resolve(exit),
        (u) =>
          resolve(exit.pipe(Exit.appendCause<never>(new Cause.Unexpected(u)))),
      );

    scope.addDisposable(stream.run(
      Sink.make(
        (cause) => onExit(new Exit.Failure(cause)),
        constVoid,
        () => onExit(Exit.void),
      ),
      runtime,
    ));

    return {
      exit: promise,
      [Symbol.asyncDispose]: async () => {
        await scope.close(Exit.interrupted()).run(runtime)
      },
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
        (cause) => onExit(Exit.failure(cause)),
        (a) => { events.push(a) },
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
  make((sink, runtime) => effect.pipe(
    Effect.matchCause(
      (cause) => Effect.sync(() => sink.error(cause)),
      (value) => Effect.sync(() => {
        sink.event(value);
        sink.end();
      })
    ),
    Effect.makeRunFork(runtime)
  ));

export const mapEffect =
  <A, R2, E2, B>(f: (a: A) => Effect.Effect<R2, E2, B>) =>
    <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
      stream.pipe(flatMap((a: A) => fromEffect(f(a))));

export const mapEffectConcurrently = <R, E, A, R2, E2, B>(
  f: (a: A) => Effect.Effect<R2, E2, B>,
  concurrency: number,
) =>
  (stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
    stream.pipe(flatMapConcurrently((a: A) => fromEffect(f(a)), concurrency));

export const switchMapEffect =
  <A, R2, E2, B>(f: (a: A) => Effect.Effect<R2, E2, B>) =>
    <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
      stream.pipe(switchMap((a: A) => fromEffect(f(a))));

export const exhaustMapEffect =
  <A, R2, E2, B>(f: (a: A) => Effect.Effect<R2, E2, B>) =>
    <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
      stream.pipe(exhaustMap((a: A) => fromEffect(f(a))));

export const exhaustLatestMapEffect =
  <A, R2, E2, B>(f: (a: A) => Effect.Effect<R2, E2, B>) =>
    <R, E>(stream: Stream<R, E, A>): Stream<R | R2, E | E2, B> =>
      stream.pipe(exhaustLatestMap((a: A) => fromEffect(f(a))));

export const catchAll =
  <E, R2, E2, B>(f: (cause: Cause.Cause<E>) => Stream<R2, E2, B>) =>
    <R, A>(stream: Stream<R, E, A>): Stream<R | R2, E2, A | B> =>
      make((sink, runtime) => {
        const d = Disposable.settable();
        let innerCount = 0;
        let outerEnded = false;

        d.add(stream.run(
          Sink.make(
            (cause) => {
              const innerDisposable = d.extend();
              innerCount++;

              innerDisposable.add(
                f(cause).run(
                  Sink.make(
                    async (cause) => {
                      await Disposable.dispose(d);
                      sink.error(cause);
                    },
                    sink.event,
                    async () => {
                      await Disposable.dispose(innerDisposable);
                      innerCount--;
                      if (outerEnded && innerCount === 0) {
                        sink.end();
                      }
                    },
                  ),
                  runtime,
                ),
              );
            },
            sink.event,
            async () => {
              outerEnded = true;
              if (innerCount === 0) {
                await Disposable.dispose(d);
                sink.end();
              }
            },
          ),
          runtime,
        ));

        return d;
      });

export const catchError =
  <E, R2, E2, B>(f: (error: E) => Stream<R2, E2, B>) =>
    <R, A>(stream: Stream<R, E, A>): Stream<R | R2, E2, A | B> =>
      stream.pipe(catchAll(Cause.expectedOrNever(
        f,
        failure,
      )));

export const matchAll = <E, R2, E2, B, A, R3, E3, C>(
  onFailure: (cause: Cause.Cause<E>) => Stream<R2, E2, B>,
  onSuccess: (value: A) => Stream<R3, E3, C>,
) =>
  <R>(stream: Stream<R, E, A>): Stream<R | R2 | R3, E2 | E3, B | C> =>
    make((sink, runtime) => {
      const scope = runtime.scope.extend();
      const innerRuntime = { ...runtime, scope };
      let running = 0;
      let outerEnded = false;

      const runStream = (stream: Stream<R2 | R3, E2 | E3, B | C>) => {
        const inner = scope.extend();
        running++;

        inner.addDisposable(stream.run(
          Sink.make(sink.error, sink.event, async () => {
            await inner.close(Exit.void).run(innerRuntime);
            running--;
            if (outerEnded && running === 0) {
              sink.end();
            }
          }),
          { ...innerRuntime, scope: inner },
        ));
      };

      return scope.addDisposable(stream.run(
        Sink.make(
          (cause) => runStream(onFailure(cause)),
          (value) => runStream(onSuccess(value)),
          () => {
            outerEnded = true;
            if (running === 0) {
              return sink.end();
            }
          },
        ),
        innerRuntime,
      ));
    });

export const matchAllEffect = <E, R2, E2, B, A, R3, E3, C>(
  onFailure: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, B>,
  onSuccess: (value: A) => Effect.Effect<R3, E3, C>,
) =>
  <R>(stream: Stream<R, E, A>): Stream<R | R2 | R3, E2 | E3, B | C> =>
    stream.pipe(matchAll(
      (cause) => fromEffect(onFailure(cause)),
      (value) => fromEffect(onSuccess(value)),
    ));

export const matchError =
  <E, R2, E2, B>(f: (error: E) => Stream<R2, E2, B>) =>
    <R>(stream: Stream<R, E, B>): Stream<R | R2, E2, B> =>
      stream.pipe(catchAll(Cause.expectedOrNever(f, failure)));

export const switchMatch = <E, R2, E2, B, A, R3, E3, C>(
  onFailure: (cause: Cause.Cause<E>) => Stream<R2, E2, B>,
  onSuccess: (value: A) => Stream<R3, E3, C>,
) =>
  <R>(stream: Stream<R, E, A>): Stream<R | R2 | R3, E2 | E3, B | C> =>
    make((sink, runtime) => {
      const scope = runtime.scope.extend();
      const innerRuntime = { ...runtime, scope };
      let current: Scope.Scope | undefined;
      let outerEnded = false;

      const runStream = async (stream: Stream<R2 | R3, E2 | E3, B | C>) => {
        if (current) {
          await current.close(Exit.interrupted()).run(innerRuntime);
        }
        current = runtime.scope.extend();
        const currentRuntime = { ...innerRuntime, scope: current };

        current.addDisposable(stream.run(
          Sink.make(sink.error, sink.event, async () => {
            if (current) {
              await current.close(Exit.void).run(currentRuntime);
              current = undefined;
            }

            if (outerEnded && current === undefined) {
              sink.end();
            }
          }),
          currentRuntime
        ));
      };

      return scope.addDisposable(stream.run(
        Sink.make(
          (cause) => runStream(onFailure(cause)),
          (value) => runStream(onSuccess(value)),
          () => {
            outerEnded = true;
            if (current === undefined) {
              return sink.end();
            }
          },
        ),
        innerRuntime
      ));
    });

export const switchMatchEffect = <E, R2, E2, B, A, R3, E3, C>(
  onFailure: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, B>,
  onSuccess: (value: A) => Effect.Effect<R3, E3, C>,
) =>
  <R>(stream: Stream<R, E, A>): Stream<R | R2 | R3, E2 | E3, B | C> =>
    stream.pipe(switchMatch(
      (cause) => fromEffect(onFailure(cause)),
      (value) => fromEffect(onSuccess(value)),
    ));

export const switchMatchError =
  <E, R2, E2, B, A, R3, E3, C>(
    onError: (error: E) => Stream<R2, E2, B>,
    onSuccess: (value: A) => Stream<R3, E3, C>,
  ) =>
    <R>(stream: Stream<R, E, A>): Stream<R | R2 | R3, E2 | E3, B | C> =>
      stream.pipe(switchMatch(
        Cause.expectedOrNever(onError, failure),
        onSuccess,
      ));

export const switchMatchErrorEffect =
  <E, R2, E2, B, A, R3, E3, C>(
    onError: (error: E) => Effect.Effect<R2, E2, B>,
    onSuccess: (value: A) => Effect.Effect<R3, E3, C>,
  ) =>
    <R>(stream: Stream<R, E, A>): Stream<R | R2 | R3, E2 | E3, B | C> =>
      stream.pipe(switchMatchEffect(
        Cause.expectedOrNever(onError, Effect.failure),
        onSuccess,
      ));
