export class Stack<T> {
  constructor(readonly value: T, readonly previous: Stack<T> | null) {}
}

export function push<T>(stack: Stack<T>, value: T): Stack<T> {
  return new Stack(value, stack);
}

export function pop<T>(stack: Stack<T>): Stack<T> | null {
  return stack.previous;
}

export function map<T>(stack: Stack<T>, f: (t: T) => T): Stack<T> {
  return new Stack(f(stack.value), stack.previous);
}
