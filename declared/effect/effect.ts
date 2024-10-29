import * as AsyncIterable from "@declared/async_iterable";
import * as Cause from "@declared/cause";
import * as Context from "@declared/context";
import type { Either, Left, Right } from "@declared/either";
import { type Exit, Failure, Success } from "@declared/exit";
import type { Fiber } from "@declared/fiber";
import type { LocalVar } from "@declared/local_var";
import * as LocalVars from "@declared/local_vars";
import * as Option from "@declared/option";
import { pipeArguments } from "@declared/pipeable";
import * as Scope from "@declared/scope";
import * as Stack from "@declared/stack";
import type { Tag } from "@declared/tag";

export interface Effect<out R, out E, out A>
  extends AsyncIterable.AsyncIterable<Effect.Instruction<R, E, any>, A> {}

export declare namespace Effect {
  export type Instruction<R, E, A> =
    | Tag<R, A>
    | Cause.Cause<E>
    | Either<E, A>
    | Exit<E, A>
    | Option.Option<A>
    | LocalVar<A>
    | LocalVars.GetLocalVars
    | Context.GetContext<R>
    | Context.ProvideContext<any>
    | Context.PopContext
    | Scope.GetScope;

  export type FailureInstruction<E> = Failure<E> | Cause.Cause<E> | Left<E>;

  export type GetContext<T> = [T] extends [Tag<infer R, any>] ? R
    : [T] extends [Context.GetContext<infer R>] ? R
    : never;

  export type GetFailure<T> = [T] extends [Cause.Cause<infer E>] ? E
    : [T] extends [Left<infer E>] ? E
    : [T] extends [Failure<infer E>] ? E
    : never;

  export type GetValue<T> = [T] extends [Option.Some<infer A>] ? A
    : [T] extends [Right<infer A>] ? A
    : [T] extends [Success<infer A>] ? A
    : [T] extends [LocalVar<infer A>] ? A
    : [T] extends [Tag<infer _, infer A>] ? A
    : never;
}

export interface Runtime<R> extends ReturnType<typeof makeRuntime<R>> {}

export function makeRuntime<R>(
  initialContext: Context.Context<R>,
  initialLocalVars: LocalVars.LocalVars,
  initialScope: Scope.Scope,
) {
  function runFork<E, A>(effect: Effect<R, E, A>): Fiber<E, A> {
    const fiber = new FiberRuntime(
      new Stack.Stack(initialContext, null),
      initialLocalVars.fork(),
      initialScope.extend(),
      effect,
    );

    fiber.start();

    return fiber;
  }

  return {
    runFork,
    runExit: <E, A>(effect: Effect<R, E, A>): Promise<Exit<E, A>> =>
      runFork(effect).exit,
    run: async <E = never, A = never>(effect: Effect<R, E, A>): Promise<A> => {
      const exit = await runFork(effect).exit;
      if (exit._id === "Success") {
        return exit.value;
      }
      return Promise.reject(exit.cause);
    },
    [Symbol.asyncDispose]: () => initialScope[Symbol.asyncDispose](),
  } as const;
}

type DeferredPromise<T> = ReturnType<typeof Promise.withResolvers<T>>;

class FiberRuntime<E, A> implements Fiber<E, A> {
  private _exit: DeferredPromise<Exit<E, A>>;
  private _exited: boolean = false;
  private _iterator: AsyncIterator<Effect.Instruction<any, E, any>, A>;
  private _result!: IteratorResult<Effect.Instruction<any, E, any>, A>;

  readonly exit: Promise<Exit<E, A>>;

  constructor(
    private stack: Stack.Stack<Context.Context<any>>,
    private localVars: LocalVars.LocalVars,
    private scope: Scope.Scope,
    effect: Effect<any, E, A>,
  ) {
    this._exit = Promise.withResolvers();
    this.exit = this._exit.promise;
    this._iterator = AsyncIterable.iterator(effect);
  }

  [Symbol.asyncIterator] = async function* (this: FiberRuntime<E, A>) {
    const vars = yield* new LocalVars.GetLocalVars();
    const exit = await this._exit.promise;
    const a = (yield exit) as A;
    vars.join(this.localVars);
    return a;
  }.bind(this);

  [Symbol.asyncDispose] = async function (this: FiberRuntime<E, A>) {
    if (this._iterator.return) {
      await this._iterator.return();
    }

    if (!this._exited) {
      await this.onExitFailure(new Failure<never>(new Cause.Interrupted()));
      await this.exit.catch(() => null);
    }

    await this.scope[Symbol.asyncDispose]();
  }.bind(this);

  pipe() {
    return pipeArguments(this, arguments);
  }

  async start() {
    try {
      this._result = await this._iterator.next().catch((error) => {
        return { value: new Cause.Unexpected(error), done: false };
      });
      await this.eventLoop();
    } finally {
      await this[Symbol.asyncDispose]();
    }
  }

  private async eventLoop() {
    while (!this._result.done && !this._exited) {
      await this.step(this._result.value).catch((error) => {
        this._result = { value: new Cause.Unexpected(error), done: false };
      });
    }

    await this.onExit(new Success(this._result.value as A));
  }

  private step(instruction: Effect.Instruction<any, E, any>) {
    switch (instruction._id) {
      case "Some":
      case "Right":
      case "Success":
        return this.stepSuccess(instruction.value);
      case "Failure":
        return this.stepCause(instruction.cause);
      case "GetContext":
        return this.stepGetContext(instruction);
      case "ProvideContext":
        return this.stepProvideContext(instruction);
      case "PopContext":
        return this.stepPopContext(instruction);
      case "Tag":
        return this.stepTag(instruction);
      case "GetScope":
        return this.stepSuccess(this.scope);
      case "GetLocalVars":
        return this.stepGetLocalVars(instruction);
      case "LocalVar":
        return this.stepLocalVar(instruction);
      case "None":
        return this.stepCause(new Cause.Empty());
      case "Left":
        return this.stepCause(new Cause.Expected(instruction.cause));
      case "Unexpected":
      case "Concurrent":
      case "Empty":
      case "Expected":
      case "Interrupted":
      case "Sequential":
        return this.stepCause(instruction);
      default:
        throw new Error(`Unhandled instruction: ${instruction}`);
    }
  }

  private async stepSuccess(value: any) {
    this._result = await this._iterator.next(value);
  }

  private async stepCause(cause: Cause.Cause<E>) {
    if (this._iterator.throw) {
      try {
        this._result = await this._iterator.throw!(cause);
      } catch {
        await this.onExit(new Failure(cause));
      }
    } else {
      await this.onExit(new Failure(cause));
    }
  }

  private async stepGetContext(_: Context.GetContext<any>) {
    this._result = await this._iterator.next(this.stack.value);
  }

  private async stepProvideContext(_: Context.ProvideContext<any>) {
    this.stack = Stack.push(this.stack, _.context);
    this._result = await this._iterator.next();
  }

  private async stepPopContext(_: Context.PopContext) {
    this.stack = Stack.pop(this.stack) ?? this.stack;
    this._result = await this._iterator.next();
  }

  private async stepTag(_: Tag<any, any>) {
    const service = this.stack.value.pipe(Context.get(_));
    if (Option.isNone(service)) {
      return await this.stepCause(
        new Cause.Unexpected(new Error(`Service not found: ${_.identifier}`)),
      );
    }

    this._result = await this._iterator.next(service.value);
  }

  private async stepGetLocalVars(_: LocalVars.GetLocalVars) {
    this._result = await this._iterator.next(this.localVars);
  }

  private async stepLocalVar(_: LocalVar<any>) {
    this._result = await this._iterator.next(this.localVars.get(_));
  }

  private onExit(exit: Exit<E, A>) {
    if (this._exited) {
      return;
    }

    this._exited = true;
    switch (exit._id) {
      case "Success":
        return this.onExitSuccess(exit);
      case "Failure":
        return this.onExitFailure(exit);
    }
  }

  private async onExitSuccess(exit: Success<A>) {
    try {
      await this.scope[Symbol.asyncDispose]();
      this._exit.resolve(exit);
    } catch (error) {
      this._exit.resolve(new Failure<never>(new Cause.Unexpected(error)));
    }
  }

  private async onExitFailure(exit: Failure<E>) {
    try {
      await this.scope[Symbol.asyncDispose]();
      this._exit.resolve(exit);
    } catch (error) {
      this._exit.resolve(
        new Failure<never>(
          new Cause.Sequential([exit.cause, new Cause.Unexpected(error)]),
        ),
      );
    }
  }
}

export const succeed = <const A>(a: A): Effect<never, never, A> =>
  new Success(a);

export const failure = <E>(
  cause: Cause.Cause<E>,
): Effect<never, E, never> => new Failure(cause);

export const suspend = <R, E, A>(f: () => Effect<R, E, A>): Effect<R, E, A> =>
  AsyncIterable.make(() => f()[Symbol.asyncIterator]());

export const interrupt = suspend(() => new Cause.Interrupted());

export const unexpected = (error: unknown): Effect<never, never, never> =>
  new Cause.Unexpected(error);

export const none = suspend<never, never, never>(() => new Cause.Empty());

export const expected = <const E>(
  error: E,
  options?: ErrorOptions,
): Effect<never, E, never> => new Cause.Expected(error, options);

export const rootScope = Scope.make();

export const {
  runFork,
  runExit,
  run,
  [Symbol.asyncDispose]: interruptRootFibers,
} = makeRuntime(Context.empty, LocalVars.make(), rootScope);

export const map = <A, B>(
  f: (a: A) => B,
) =>
<R, E>(effect: Effect<R, E, A>): Effect<R, E, B> =>
  effect.pipe(AsyncIterable.map(f));

export const flatMap = <A, R2, E2, B>(
  f: (a: A) => Effect<R2, E2, B>,
) =>
<R, E>(effect: Effect<R, E, A>): Effect<R | R2, E | E2, B> =>
  AsyncIterable.make(async function* () {
    const a = yield* effect;
    return yield* f(a);
  });

export const gen = <Yield extends Effect.Instruction<any, any, any>, Return>(
  f: () => AsyncGenerator<Yield, Return>,
): Effect<Effect.GetContext<Yield>, Effect.GetFailure<Yield>, Return> =>
  AsyncIterable.make<any, Return>(() => f());

export const fork = <R, E, A>(
  effect: Effect<R, E, A>,
): Effect<R, never, Fiber<E, A>> =>
  gen(async function* () {
    const context = yield* new Context.GetContext<R>();
    const localVars = yield* new LocalVars.GetLocalVars();
    const scope = yield* new Scope.GetScope();
    const runtime = makeRuntime(context, localVars, scope);
    const fiber = runtime.runFork(effect);

    return fiber;
  });

export const forkIn = (scope: Scope.Scope) =>
<R, E, A>(
  effect: Effect<R, E, A>,
): Effect<R, never, Fiber<E, A>> =>
  gen(async function* () {
    const context = yield* new Context.GetContext<R>();
    const localVars = yield* new LocalVars.GetLocalVars();
    const runtime = makeRuntime(context, localVars, scope);
    const fiber = runtime.runFork(effect);

    return fiber;
  });

export const forkScoped = <R, E, A>(
  effect: Effect<R, E, A>,
): Effect<R | Scope.Scope, never, Fiber<E, A>> =>
  gen(async function* () {
    const scope = yield* Scope.Scope;
    return yield* effect.pipe(forkIn(scope));
  });

export const forkDaemon: <R, E, A>(
  effect: Effect<R, E, A>,
) => Effect<R, never, Fiber<E, A>> = forkIn(rootScope);

export const addDisposable = (
  disposable: Disposable | AsyncDisposable,
): Effect<never, never, Disposable> =>
  gen(async function* () {
    const scope = yield* new Scope.GetScope();
    return scope.add(disposable);
  });

export const fromPromise = <A>(
  f: (signal: AbortSignal) => Promise<A>,
): Effect<never, never, A> =>
  gen(async function* () {
    const controller = new AbortController();
    using _ = yield* addDisposable({
      [Symbol.dispose]: () => controller.abort(),
    });
    return await f(controller.signal);
  });

export const dispose = (
  disposable: Disposable | AsyncDisposable,
): Effect<never, never, void> =>
  fromPromise(async () => {
    if (isSyncDisposable(disposable)) {
      disposable[Symbol.dispose]();
    } else {
      await disposable[Symbol.asyncDispose]();
    }
  });

const isSyncDisposable = (
  disposable: Disposable | AsyncDisposable,
): disposable is Disposable => Reflect.has(disposable, Symbol.dispose);

export const catchAll = <E, R2, E2, B>(
  f: (error: Cause.Cause<E>) => Effect<R2, E2, B>,
) =>
<R, A>(effect: Effect<R, E, A>): Effect<R | R2, E2, A | B> =>
  AsyncIterable.make(async function* () {
    const generator = effect[Symbol.asyncIterator]();
    let result: IteratorResult<Effect.Instruction<R, E, any>, A | B> =
      await generator
        .next()
        .catch((error) => {
          return { value: new Cause.Unexpected(error), done: false };
        });

    while (!result.done) {
      const instruction = result.value;
      switch (instruction._id) {
        case "Failure":
          return yield* f(instruction.cause);
        case "Empty":
        case "Expected":
        case "Unexpected":
        case "Interrupted":
        case "Sequential":
        case "Concurrent":
          return yield* f(instruction);
        case "Left":
          return yield* f(new Cause.Expected(instruction.cause));
        default:
          result = await generator.next(
            yield result.value as Exclude<
              Effect.Instruction<R, E, A>,
              Effect.FailureInstruction<E>
            >,
          );
      }
    }

    return result.value;
  });

export const set = <A>(
  value: A,
) =>
(localVar: LocalVar<A>): Effect<never, never, A> =>
  gen(async function* () {
    const vars = yield* new LocalVars.GetLocalVars();
    vars.set(localVar, value);
    return value;
  });

export const locally = <X>(
  localVar: LocalVar<X>,
  value: X,
) =>
<R, E, A>(effect: Effect<R, E, A>): Effect<R, E, A> =>
  gen(async function* () {
    const vars = yield* new LocalVars.GetLocalVars();
    vars.push(localVar, value);
    try {
      return yield* effect;
    } finally {
      vars.pop(localVar);
    }
  });

export const provideContext =
  <R2>(provided: Context.Context<R2>) =>
  <R, E, A>(effect: Effect<R, E, A>): Effect<Exclude<R, R2>, E, A> =>
    gen(async function* () {
      const ctx = yield* new Context.GetContext<Exclude<R, R2>>();
      yield* new Context.ProvideContext(ctx.pipe(Context.merge(provided)));
      try {
        return yield* effect;
      } finally {
        yield* new Context.PopContext();
      }
    });

export const scoped = <R, E, A>(
  effect: Effect<R, E, A>,
): Effect<Exclude<R, Scope.Scope>, E, A> =>
  gen(async function* () {
    const parentScope = yield* new Scope.GetScope();
    const scope = parentScope.extend();

    try {
      return yield* effect.pipe(
        provideContext(Context.make(Scope.Scope, scope)),
      );
    } finally {
      await dispose(scope);
    }
  });
