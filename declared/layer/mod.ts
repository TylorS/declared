import * as C from "@declared/context";
import * as Scope from "@declared/scope";
import { Effect } from "../mod.ts";
import { Tag } from "@declared/tag";

export type Layer<out R, out E, out A> = Effect.Effect<R | Scope.Scope, E, C.Context<A>>;

export const fromContext = <A>(context: C.Context<A>): Layer<never, never, A> =>
  Effect.success(context);

export const effect = <Id, S, R, E>(
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
