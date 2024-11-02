import * as AsyncIterable from "@declared/async_iterable";
import * as Option from "@declared/option";
import { type Pipeable, pipeArguments } from "@declared/pipeable";
import type { Tag } from "../tag/tag.ts";

export const TypeId = Symbol.for("@declared/Context");

export interface Context<Resources> extends Pipeable {
  readonly [TypeId]: Context.Variance<Resources>;

  /**
   * @internal
   */
  readonly services: Map<Tag<any, any>, any>;
}

export declare namespace Context {
  export interface Variance<Resources> {
    readonly _Resources: (_: never) => Resources;
  }
}

const variance: Context.Variance<any> = {
  _Resources: (_) => _,
};

const Proto = {
  [TypeId]: variance,
  pipe() {
    return pipeArguments(this, arguments);
  },
};

const makeProto = (services: Map<Tag<any, any>, any>) => {
  const proto = Object.create(Proto);
  proto.services = services;
  return proto;
};

export const empty: Context<never> = makeProto(new Map());

export const make = <Identifier, Service>(
  tag: Tag<Identifier, Service>,
  service: Service,
): Context<Identifier> => makeProto(new Map([[tag, service]]));

export const add = <Identifier, Service>(
  tag: Tag<Identifier, Service>,
  service: Service,
): <R>(context: Context<R>) => Context<R | Identifier> =>
(context) => {
  const ctx = Object.create(Proto);
  ctx.services = new Map(context.services);
  ctx.services.set(tag, service);
  return ctx;
};

export const get = <Identifier, Service>(
  tag: Tag<Identifier, Service>,
): <R>(context: Context<R>) => Option.Option<Service> =>
(context) =>
  context.services.has(tag)
    ? Option.some(context.services.get(tag)!)
    : Option.none();

export const merge =
  <R2>(provided: Context<R2>) => <R>(ctx: Context<R>): Context<R | R2> => {
    const merged = Object.create(Proto);
    merged.services = new Map(ctx.services);
    provided.services.forEach((service, tag) => {
      merged.services.set(tag, service);
    });
    return merged;
  };

export class GetContext<R>
  extends AsyncIterable.Yieldable(`GetContext`)<Context<R>> {}

export class ProvideContext<R>
  extends AsyncIterable.Yieldable(`ProvideContext`)<void> {
  constructor(readonly context: Context<R>) {
    super();
  }
}

export class PopContext extends AsyncIterable.Yieldable(`PopContext`)<void> {}
