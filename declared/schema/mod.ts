import * as AST from "./AST.ts";

export const TypeId = Symbol.for("@declared/Schema");
export type TypeId = typeof TypeId;

export interface Schema<in I, out R, out E, out O> {
  readonly [TypeId]: Schema.Variance<I, R, E, O>;
  readonly ast: AST.AST;
}

export declare namespace Schema {
  export interface Variance<in I, out R, out E, out O> {
    readonly _Input: (_: I) => never;
    readonly _Resources: (_: never) => R;
    readonly _Error: (_: never) => E;
    readonly _Output: (_: never) => O;
  }
}
