import { Pipeable, pipeArguments } from "@declared/pipeable";

declare global {
  interface Object extends Pipeable {}
}

// deno-lint-ignore ban-types
Object.prototype.pipe = function pipe(this: Object) {
  return pipeArguments(this, arguments);
};
