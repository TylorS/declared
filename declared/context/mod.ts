export const TypeId = Symbol.for("@declared/Context");

export interface Context<out Resources> {
  readonly [TypeId]: Context.Variance<Resources>;
}

export declare namespace Context {
  export interface Variance<Resources> {
    readonly _Resources: (_: never) => Resources;
  }
}
