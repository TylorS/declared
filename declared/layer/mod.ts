import * as C from "@declared/context";
import * as Scope from "@declared/scope";
import { Effect } from "../mod.ts";
import { Tag } from "@declared/tag";

export type Layer<out R, out E, out A> = Effect.Effect<
  R | Scope.Scope,
  E,
  C.Context<A>
>;

export declare namespace Layer {
  export type Context<T> = T extends Layer<infer R, infer E, infer A> ? R
    : never;
  export type Error<T> = T extends Layer<infer R, infer E, infer A> ? E : never;
  export type Services<T> = T extends Layer<infer R, infer E, infer A> ? A
    : never;
}

export const fromContext = <A>(context: C.Context<A>): Layer<never, never, A> =>
  Effect.success(context);

export const of = <Id, S>(
  tag: Tag<Id, S>,
  value: S,
): Layer<never, never, Id> => Effect.success(C.make(tag, value));

export const fromEffect = <Id, S, R, E>(
  tag: Tag<Id, S>,
  effect: Effect.Effect<R | Scope.Scope, E, S>,
): Layer<R, E, Id> => effect.pipe(Effect.map((s) => C.make(tag, s)));

export const orElse = <R2, E2, A>(
  orElse: () => Layer<R2, E2, A>,
) =>
<R, E>(layer: Layer<R, E, A>): Layer<R | R2, E | E2, A> =>
  layer.pipe(
    Effect.catchAll(() => orElse()),
  );

export const merge = <R2, E2, B>(
  second: Layer<R2, E2, B>,
) =>
<R, E, A>(first: Layer<R, E, A>): Layer<R | R2, E | E2, A | B> =>
  Effect.gen(async function* () {
    const ctx1 = yield* first;
    const ctx2 = yield* second;
    return ctx1.pipe(C.merge(ctx2));
  });

export const mergeAll = <Layers extends ReadonlyArray<Layer<any, any, any>>>(
  ...layers: Layers
): Layer<
  Layer.Context<Layers[number]>,
  Layer.Error<Layers[number]>,
  Layer.Services<Layers[number]>
> => layers.reduce((acc, layer) => merge(layer)(acc), fromContext(C.empty));

export const provide = <R2, E2, B>(
  provided: Layer<R2, E2, B>,
) =>
<R, E, A>(layer: Layer<R, E, A>): Layer<R | R2, E | E2, A> =>
  Effect.gen(async function* () {
    const ctx1 = yield* provided;
    return yield* layer.pipe(Effect.provideContext(ctx1));
  });

export const provideMerge = <R2, E2, B>(
  provided: Layer<R2, E2, B>,
) =>
<R, E, A>(layer: Layer<R, E, A>): Layer<R | R2, E | E2, A | B> =>
  Effect.gen(async function* () {
    const ctx1 = yield* provided;
    const ctx2 = yield* layer.pipe(Effect.provideContext(ctx1));
    return ctx2.pipe(C.merge(ctx1));
  });
