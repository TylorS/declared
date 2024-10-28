import * as AsyncIterable from "@declared/async_iterable";
import * as Cause from "@declared/cause";
import * as Context from "@declared/context";
import type { Either } from "@declared/either";
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
      initialLocalVars,
      initialScope.extend(),
      effect,
    );

    fiber.start();
    return fiber;
  }

  return {
    runFork,
    runExit: <E, A>(effect: Effect<R, E, A>): Promise<Exit<E, A>> =>
      Promise.resolve(runFork(effect)),
    run: async <E = never, A = never>(effect: Effect<R, E, A>): Promise<A> => {
      const fiber = runFork(effect);
      const exit = await fiber;
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

  constructor(
    private stack: Stack.Stack<Context.Context<any>>,
    private localVars: LocalVars.LocalVars,
    private scope: Scope.Scope,
    effect: Effect<any, E, A>,
  ) {
    this._exit = Promise.withResolvers();
    this._iterator = AsyncIterable.iterator(effect);
  }

  then<TResult1 = Exit<E, A>, TResult2 = never>(
    onfulfilled?:
      | ((value: Exit<E, A>) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): Promise<TResult1 | TResult2> {
    return this._exit.promise.then(onfulfilled, onrejected);
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

    await this.scope[Symbol.asyncDispose]();
  }.bind(this);

  pipe() {
    return pipeArguments(this, arguments);
  }

  async start() {
    try {
      this._result = await this._iterator.next();
      await this.eventLoop();
    } finally {
      await this[Symbol.asyncDispose]();
    }
  }

  private async eventLoop() {
    while (!this._result.done && !this._exited) {
      await this.step(this._result.value);
    }

    if (this._exited) {
      return;
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

export const interrupt = (): Effect<never, never, never> =>
  failure<never>(new Cause.Interrupted());

export const unexpected = (error: unknown): Effect<never, never, never> =>
  failure<never>(new Cause.Unexpected(error));

export const suspend = <R, E, A>(f: () => Effect<R, E, A>): Effect<R, E, A> =>
  AsyncIterable.make(() => f()[Symbol.asyncIterator]());

export const none = suspend(() => failure(new Cause.Empty()));

export const expected = <const E>(error: E) =>
  failure(new Cause.Expected(error));

export const {
  runFork,
  runExit,
  run,
  [Symbol.asyncDispose]: interruptRootFibers,
} = makeRuntime(Context.empty, LocalVars.make(), Scope.make());

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
