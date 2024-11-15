import * as AsyncIterable from "@declared/async_iterable";
import * as Cause from "@declared/cause";
import * as C from "@declared/context";
import * as Deferred from "@declared/deferred";
import * as Disposable from "@declared/disposable";
import * as Either from "@declared/either";
import * as Exit from "@declared/exit";
import * as LocalVar from "@declared/local_var";
import * as LocalVars from "@declared/local_vars";
import * as Option from "@declared/option";
import * as Scheduler from "@declared/scheduler";
import * as Scope from "@declared/scope";
import { Tag } from "@declared/tag";
import { Duration } from "@declared/duration";

export const EFFECT_ID = "Effect" as const;

export abstract class Effect<out R, out E, out A>
  extends AsyncIterable.Yieldable(EFFECT_ID)<A> {
  abstract run(
    runtime: Effect.Runtime<R>,
  ): Promise<Exit.Exit<E, A>>;
}

export declare namespace Effect {
  export type Runtime<in R> = {
    readonly context: C.Context<R>;
    readonly localVars: LocalVars.LocalVars;
    readonly scope: Scope.Scope;
    readonly scheduler: Scheduler.Scheduler;
  };

  export type Context<T> = [T] extends [never] ? []
    : [T] extends [Effect<infer R, infer E, infer A>] ? R
    : [T] extends [Tag<infer R, any>] ? R
    : [T] extends [C.GetContext<infer R>] ? R
    : never;

  export type Error<T> = [T] extends [never] ? never
    : [T] extends [Effect<infer R, infer E, infer A>] ? E
    : [T] extends [Cause.Cause<infer E>] ? E
    : [T] extends [Either.Either<infer E, infer A>] ? E
    : [T] extends [Exit.Exit<infer E, infer A>] ? E
    : never;

  export type Success<T> = [T] extends [never] ? never
    : [T] extends [Effect<infer R, infer E, infer A>] ? A
    : [T] extends [Option.Option<infer A>] ? A
    : [T] extends [LocalVar.LocalVar<infer A>] ? A
    : [T] extends [Tag<infer R, infer A>] ? A
    : [T] extends [Either.Either<infer E, infer A>] ? A
    : [T] extends [Exit.Exit<infer E, infer A>] ? A
    : never;

  export type Instruction<R, E, A> =
    | C.GetContext<R>
    | Tag<R, A>
    | Cause.Cause<E>
    | Either.Either<E, A>
    | Exit.Exit<E, A>
    | Option.Option<A>
    | LocalVar.LocalVar<A>
    | LocalVars.GetLocalVars
    | Scope.GetScope
    | Effect<R, E, A>;
}

class Success<A> extends Effect<never, never, A> {
  private _result: Promise<Exit.Exit<never, A>>;
  constructor(readonly value: A) {
    super();
    this._result = Promise.resolve(Exit.success(this.value));
  }

  run(_: Effect.Runtime<never>): Promise<Exit.Exit<never, A>> {
    return this._result;
  }
}

export const success = <A>(value: A): Effect<never, never, A> =>
  new Success(value);

class Failure<E> extends Effect<never, E, never> {
  private _result: Promise<Exit.Exit<E, never>>;
  constructor(readonly cause: Cause.Cause<E>) {
    super();
    this._result = Promise.resolve(Exit.failure(this.cause));
  }

  run(_: Effect.Runtime<never>): Promise<Exit.Exit<E, never>> {
    return this._result;
  }
}

export const failure = <E = never>(
  cause: Cause.Cause<E>,
): Effect<never, E, never> => new Failure(cause);

class Service<R, A> extends Effect<R, never, A> {
  constructor(readonly tag: Tag<R, A>) {
    super();
  }

  run(runtime: Effect.Runtime<R>): Promise<Exit.Exit<never, A>> {
    return runtime.context.pipe(
      C.get(this.tag),
      Option.match(
        () => Promise.resolve(Exit.unexpected("Service not found")),
        (service) => Promise.resolve(Exit.success(service)),
      ),
    );
  }
}

export const service = <R, A>(tag: Tag<R, A>): Effect<R, never, A> =>
  new Service(tag);

class GetLocalVars extends Effect<never, never, LocalVars.LocalVars> {
  run(
    _: Effect.Runtime<never>,
  ): Promise<Exit.Exit<never, LocalVars.LocalVars>> {
    return Promise.resolve(Exit.success(_.localVars));
  }
}

export const getLocalVars: Effect<never, never, LocalVars.LocalVars> =
  new GetLocalVars();

class GetScope extends Effect<never, never, Scope.Scope> {
  run(_: Effect.Runtime<never>): Promise<Exit.Exit<never, Scope.Scope>> {
    return Promise.resolve(Exit.success(_.scope));
  }
}

export const getScope: Effect<never, never, Scope.Scope> = new GetScope();

class GetContext<R> extends Effect<R, never, C.Context<R>> {
  run(_: Effect.Runtime<R>): Promise<Exit.Exit<never, C.Context<R>>> {
    return Promise.resolve(Exit.success(_.context));
  }
}

export const context = <R>(): Effect<R, never, C.Context<R>> =>
  new GetContext<R>();

class GetLocalVar<A> extends Effect<never, never, A> {
  constructor(readonly localVar: LocalVar.LocalVar<A>) {
    super();
  }

  run(_: Effect.Runtime<never>): Promise<Exit.Exit<never, A>> {
    return Promise.resolve(Exit.success(_.localVars.get(this.localVar)));
  }
}

export const getLocalVar = <A>(
  localVar: LocalVar.LocalVar<A>,
): Effect<never, never, A> => new GetLocalVar(localVar);

class SetLocalVar<A> extends Effect<never, never, A> {
  private _result: Promise<Exit.Exit<never, A>>;
  constructor(readonly localVar: LocalVar.LocalVar<A>, readonly value: A) {
    super();

    this._result = Promise.resolve(Exit.success(value));
  }

  run(_: Effect.Runtime<never>): Promise<Exit.Exit<never, A>> {
    _.localVars.set(this.localVar, this.value);
    return this._result;
  }
}

export const setLocalVar =
  <A>(value: A) => (localVar: LocalVar.LocalVar<A>): Effect<never, never, A> =>
    new SetLocalVar(localVar, value);

class SetVarLocally<R, E, A, B> extends Effect<R, E, A> {
  constructor(
    readonly effect: Effect<R, E, A>,
    readonly localVar: LocalVar.LocalVar<B>,
    readonly value: B,
  ) {
    super();
  }

  run(_: Effect.Runtime<R>): Promise<Exit.Exit<E, A>> {
    _.localVars.push(this.localVar, this.value);
    return this.effect.run(_).finally(() => _.localVars.pop(this.localVar));
  }
}

export const setVarLocally =
  <A>(localVar: LocalVar.LocalVar<A>, value: A) =>
  <R, E, B>(effect: Effect<R, E, B>): Effect<R, E, B> =>
    new SetVarLocally(effect, localVar, value);

class SetInterruptStatus<R, E, A> extends Effect<R, E, A> {
  constructor(readonly effect: Effect<R, E, A>, readonly value: boolean) {
    super();
  }

  run(runtime: Effect.Runtime<R>): Promise<Exit.Exit<E, A>> {
    runtime.localVars.push(LocalVar.InterruptStatus, this.value);

    return this.effect.run(runtime)
      .then((result) => {
        // Check interruption status before returning
        const interruptors = runtime.localVars.get(LocalVar.Interruptors);
        const status = runtime.localVars.get(LocalVar.InterruptStatus);

        if (interruptors.length > 0 && status) {
          // Clear the interruptors
          runtime.localVars.set(LocalVar.Interruptors, []);

          const interrupted = Exit.interrupted();

          // Resolve all interruptors
          for (const deferred of interruptors) {
            deferred.resolve(interrupted);
          }

          // Return interrupted exit regardless of success/failure
          return interrupted;
        }

        return result;
      })
      .catch((error) => {
        // If we get an unexpected error, check interruption status
        const interruptors = runtime.localVars.get(LocalVar.Interruptors);
        const status = runtime.localVars.get(LocalVar.InterruptStatus);

        if (interruptors.length > 0 && status) {
          // Clear the interruptors
          runtime.localVars.set(LocalVar.Interruptors, []);

          const interrupted = Exit.interrupted();

          // Resolve all interruptors
          for (const deferred of interruptors) {
            deferred.resolve(interrupted);
          }
        }

        // If not interrupted, propagate the original error
        return Exit.unexpected(error);
      })
      .finally(() => {
        runtime.localVars.pop(LocalVar.InterruptStatus);
      });
  }
}

export const interruptible = <R, E, A>(
  effect: Effect<R, E, A>,
): Effect<R, E, A> => new SetInterruptStatus(effect, true);

export const uninterruptible = <R, E, A>(
  effect: Effect<R, E, A>,
): Effect<R, E, A> => new SetInterruptStatus(effect, false);

export const fromInstruction = <Y extends Effect.Instruction<any, any, any>>(
  instruction: Y,
): Effect<Effect.Context<Y>, Effect.Error<Y>, Effect.Success<Y>> => {
  switch (instruction._id) {
    case "Effect":
      return instruction;
    case "Tag":
      return service(instruction);
    case "Success":
    case "Right":
    case "Some":
      return success(instruction.value);
    case "Failure":
    case "Left":
      return failure(instruction.cause);
    case "GetLocalVars":
      return getLocalVars as any;
    case "GetScope":
      return getScope as any;
    case "GetContext":
      return context() as any;
    case "LocalVar":
      return getLocalVar(instruction);
    case "None":
      return failure<never>(new Cause.Empty());
    default:
      return failure(instruction);
  }
};

class Gen<Y extends Effect.Instruction<any, any, any>, A> extends Effect<
  Effect.Context<Y>,
  Effect.Error<Y>,
  A
> {
  constructor(readonly f: () => AsyncGenerator<Y, A>) {
    super();
  }

  run(
    runtime: Effect.Runtime<Effect.Context<Y>>,
  ): Promise<Exit.Exit<Effect.Error<Y>, A>> {
    const gen = this.f();

    const runWithResult = async (result: IteratorResult<Y, A>) => {
      while (!result.done) {
        const exit = await fromInstruction(result.value).run(runtime);
        if (Exit.isFailure(exit)) {
          return exit;
        }
        result = await gen.next(exit.value);
      }
      return Exit.success(result.value);
    };

    return gen.next()
      .then(
        (result) => runWithResult(result),
        (defect) =>
          gen.throw(defect)
            .then(
              (result) => runWithResult(result),
              (defect) => Exit.unexpected(defect),
            ),
      ).then(
        (exit) => gen.return(exit as any).then(() => exit),
      );
  }
}

export function gen<Y extends Effect.Instruction<any, any, any>, A>(
  f: () => AsyncGenerator<Y, A>,
): Effect<Effect.Context<Y>, Effect.Error<Y>, A> {
  return new Gen(f);
}

export interface Fiber<E, A> extends AsyncDisposable {
  readonly exit: Promise<Exit.Exit<E, A>>;
}

const makeRunFork =
  <R>(runtime: Effect.Runtime<R>) =>
  <E, A>(effect: Effect<R, E, A>): Fiber<E, A> => {
    const scope = runtime.scope.extend();
    const localVars = runtime.localVars.fork();
    const exit = Deferred.make<E, A>();
    const interruptDeferred = Deferred.make<unknown, unknown>();
    let isDisposed = false;

    scope.add(runtime.scheduler.asap(
      Scheduler.Task.make(
        () => {
          return effect.run({
            context: runtime.context,
            localVars,
            scope,
            scheduler: runtime.scheduler,
          }).then((result) => {
            if (!isDisposed) {
              exit.resolve(result);
              interruptDeferred.resolve(result);
            }
          }).catch((error) => {
            exit.reject(error);
            interruptDeferred.reject(error);
          });
        },
        (defect) => {
          exit.reject(defect);
          interruptDeferred.reject(defect);
        },
      ),
    ));

    const dispose = async () => {
      isDisposed = true;

      const status = localVars.get(LocalVar.InterruptStatus);
      if (status) {
        // If interruptible, resolve immediately with interrupted
        const interrupt = Exit.interrupted();
        interruptDeferred.resolve(interrupt);
        exit.resolve(interrupt);
      } else {
        // If uninterruptible, add to interruptors queue
        const interruptors = localVars.get(LocalVar.Interruptors);
        interruptors.push(interruptDeferred);
      }

      // Wait for interruption to complete
      await interruptDeferred.promise;

      // Clean up scope
      await Disposable.asyncDispose(scope);
    };

    return {
      exit: exit.promise,
      [Symbol.asyncDispose]: async () => {
        await dispose().catch(async (error) => {
          console.error("Error during fiber disposal:", error);
          await Disposable.asyncDispose(scope);
        });
      },
    };
  };

export const makeRuntime = <R>(runtime: Effect.Runtime<R>) => ({
  runFork: makeRunFork(runtime),
  runExit: <E, A>(effect: Effect<R, E, A>): Promise<Exit.Exit<E, A>> =>
    effect.run(runtime),
  run: <E, A>(effect: Effect<R, E, A>): Promise<A> =>
    effect.run(runtime).then((exit) =>
      Exit.isFailure(exit) ? Promise.reject(exit.cause) : exit.value
    ),
});

export const defaultScheduler = Scheduler.make();
export const defaultScope = Scope.make();
export const defaultLocalVars = LocalVars.make();
export const defaultContext = C.empty;
export const defaultRuntime: Effect.Runtime<never> = {
  context: defaultContext,
  localVars: defaultLocalVars,
  scope: defaultScope,
  scheduler: defaultScheduler,
};

export const { runFork, runExit, run } = makeRuntime(defaultRuntime);

class MapEffect<R, E, A, B> extends Effect<R, E, B> {
  constructor(readonly effect: Effect<R, E, A>, readonly f: (a: A) => B) {
    super();
  }

  run(runtime: Effect.Runtime<R>): Promise<Exit.Exit<E, B>> {
    return this.effect.run(runtime).then(Exit.map(this.f));
  }

  static make = <R, E, A, B>(effect: Effect<R, E, A>, f: (a: A) => B) => {
    if (effect instanceof MapEffect) {
      return new MapEffect(effect.effect, (a) => f(effect.f(a)));
    }

    return new MapEffect(effect, f);
  };
}

export const map = <A, B>(f: (a: A) => B) =>
<R, E>(
  effect: Effect<R, E, A>,
): Effect<R, E, B> => MapEffect.make(effect, f);

export const none = fromInstruction(Option.none());

export const expected = <E>(error: E): Effect<never, E, never> =>
  failure(new Cause.Expected(error));

export const unexpected = (error: unknown): Effect<never, never, never> =>
  failure<never>(new Cause.Unexpected(error));

class CatchAll<R, E, A, R2, E2, B> extends Effect<R | R2, E2, A | B> {
  constructor(
    readonly effect: Effect<R, E, A>,
    readonly f: (cause: Cause.Cause<E>) => Effect<R2, E2, B>,
  ) {
    super();
  }

  run(runtime: Effect.Runtime<R | R2>): Promise<Exit.Exit<E2, A | B>> {
    return this.effect.run(runtime).then((
      exit,
    ): Promise<Exit.Exit<E2, A | B>> =>
      Exit.isFailure(exit)
        ? this.f(exit.cause).run(runtime)
        : Promise.resolve(exit)
    );
  }
}

export const catchAll = <E, R2, E2, B>(
  f: (cause: Cause.Cause<E>) => Effect<R2, E2, B>,
) =>
<R, A>(effect: Effect<R, E, A>): Effect<R | R2, E | E2, A | B> =>
  new CatchAll(effect, f);

class Fork<R, E, A> extends Effect<R, never, Fiber<E, A>> {
  constructor(readonly effect: Effect<R, E, A>) {
    super();
  }

  run(runtime: Effect.Runtime<R>): Promise<Exit.Exit<never, Fiber<E, A>>> {
    return this.effect.pipe(
      makeRunFork(runtime),
      (_) => Promise.resolve(Exit.success(_)),
    );
  }
}

export const fork = <R, E, A>(
  effect: Effect<R, E, A>,
): Effect<R, never, Fiber<E, A>> => new Fork(effect);

class FromPromise<A> extends Effect<never, never, A> {
  constructor(readonly f: (signal: AbortSignal) => Promise<A>) {
    super();
  }

  async run(_: Effect.Runtime<never>): Promise<Exit.Exit<never, A>> {
    const controller = new AbortController();
    using _disposable = _.scope.add(Disposable.sync(() => controller.abort()));
    return await this.f(controller.signal).then(Exit.success, Exit.unexpected);
  }
}

export const fromPromise = <A>(
  f: (signal: AbortSignal) => Promise<A>,
): Effect<never, never, A> => new FromPromise(f);

class Dispose extends Effect<never, never, void> {
  constructor(readonly disposable: Disposable | AsyncDisposable) {
    super();
  }

  async run(_: Effect.Runtime<never>): Promise<Exit.Exit<never, void>> {
    if (Disposable.isSync(this.disposable)) {
      Disposable.syncDispose(this.disposable);
    } else {
      await Disposable.asyncDispose(this.disposable);
    }

    return Exit.void;
  }
}

export const dispose = (
  disposable: Disposable | AsyncDisposable,
): Effect<never, never, void> => new Dispose(disposable);

export const sleep = (delay: Duration): Effect<never, never, void> =>
  fromPromise((signal) => {
    return new Promise((resolve, reject) => {
      const id = setTimeout(resolve, delay.millis);
      signal.addEventListener("abort", () => {
        clearTimeout(id);
        reject(new Cause.Interrupted());
      }, { once: true });
    });
  });
