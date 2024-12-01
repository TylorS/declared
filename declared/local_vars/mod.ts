import * as AsyncIterable from "@declared/async_iterable";
import type { LocalVar } from "@declared/local_var";
import * as Map from "@declared/map";
import * as Stack from "@declared/stack";

export interface LocalVars {
  get<T>(variable: LocalVar<T>): T;
  set<T>(variable: LocalVar<T>, value: T): void;
  push<T>(variable: LocalVar<T>, value: T): void;
  pop<T>(variable: LocalVar<T>): void;
  fork(): LocalVars;
  join(vars: LocalVars): void;
}

class LocalVarsImpl implements LocalVars {
  constructor(readonly variables: Map<LocalVar<any>, Stack.Stack<any>>) { }

  get<T>(variable: LocalVar<T>): T {
    let stack = this.variables.get(variable);
    if (stack === undefined) {
      const initial = variable.initialize();
      stack = new Stack.Stack(initial, null);
      this.variables.set(variable, stack);
      return initial;
    }
    return stack.value;
  }

  set<T>(variable: LocalVar<T>, value: T): void {
    const stack = this.variables.get(variable);
    this.variables.set(
      variable,
      new Stack.Stack(value, stack?.previous ?? null),
    );
  }

  push<T>(variable: LocalVar<T>, value: T): void {
    let stack = this.variables.get(variable);
    if (stack === undefined) {
      stack = new Stack.Stack(value, null);
      this.variables.set(variable, stack);
      return;
    }
    stack = Stack.push(stack, value);
    this.variables.set(variable, stack);
  }

  pop<T>(variable: LocalVar<T>): void {
    const stack = this.variables.get(variable);
    if (stack === undefined) {
      return;
    }
    const previous = Stack.pop(stack);
    if (previous === null) {
      this.variables.delete(variable);
      return;
    }
    this.variables.set(variable, previous);
  }

  fork(): LocalVars {
    return new LocalVarsImpl(
      this.variables.pipe(Map.map(
        (stack, variable) => Stack.map(stack, (v) => variable.fork(v)),
      )),
    );
  }

  join(vars: LocalVars): void {
    for (
      const [variable, stack] of (vars as LocalVarsImpl).variables
    ) {
      if (this.variables.has(variable)) {
        this.variables.set(
          variable,
          Stack.map(
            this.variables.get(variable)!,
            (v) => variable.join(v, stack.value),
          ),
        );
      } else {
        this.variables.set(variable, new Stack.Stack(stack.value, null));
      }
    }
  }
}

export function make(): LocalVars {
  return new LocalVarsImpl(Map.empty());
}

export class GetLocalVars
  extends AsyncIterable.Yieldable("GetLocalVars")<LocalVars> { }
