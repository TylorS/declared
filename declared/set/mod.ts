import { Pipeable, pipeArguments } from "@declared/pipeable";

declare global {
  interface Set<T> extends Pipeable {}
  interface ReadonlySet<T> extends Pipeable {}
}

Set.prototype.pipe = function pipe(this: Set<unknown>) {
  return pipeArguments(this, arguments);
};
