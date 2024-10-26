/**
 * Converts any error or value into a readable string representation.
 * Handles circular references, special objects, and error causes.
 */
export function stringify(value: unknown): string {
  const seen = new WeakSet();

  try {
    return Array.from(stringifyAnything(seen, value)).join("");
  } catch (e) {
    return `[Unstringifiable Error: ${String(e)}]`;
  }
}

function* stringifyAnything(
  seen: WeakSet<object>,
  value: unknown,
  indent = "",
  depth = 0,
): Generator<string> {
  // Handle primitive types
  if (value === null) return yield "null";
  else if (value === undefined) return yield "undefined";

  const type = typeof value;

  if (type === "string") yield `"${value}"`;
  else if (type === "number") {
    yield Object.is(value, -0) ? "-0" : String(value);
  } else if (type === "boolean") yield String(value);
  else if (type === "function") {
    // deno-lint-ignore ban-types
    yield `[Function: ${(value as Function).name || "anonymous"}]`;
  } else if (type === "symbol") {
    yield (value as symbol).description
      ? `Symbol(${(value as symbol).description})`
      : "Symbol()";
  } // Handle special objects
  else if (value instanceof Date) yield `Date(${value.toISOString()})`;
  else if (value instanceof RegExp) yield value.toString();
  else if (value instanceof Error) {
    yield* stringifyErrorObject(value, seen, indent, depth);
  } else if (value instanceof Promise) yield "[Promise]";
  else if (value instanceof WeakMap) yield "[WeakMap]";
  else if (value instanceof WeakSet) yield "[WeakSet]";
  else if (value instanceof Map) {
    yield* stringifyMap(value, seen, indent, depth);
  } else if (value instanceof Set) {
    yield* stringifySet(value, seen, indent, depth);
  } // Handle plain objects and arrays
  else if (typeof value === "object") {
    if (seen.has(value)) yield "[Circular]";
    else {
      seen.add(value);
      if (Array.isArray(value)) {
        yield* stringifyArray(value, seen, indent, depth);
      } else {
        yield* stringifyObject(value, seen, indent, depth);
      }
    }
  } else {
    yield String(value);
  }
}

function* stringifyErrorObject(
  error: Error,
  seen: WeakSet<object>,
  indent: string,
  depth: number,
): Generator<string> {
  const nextIndent = indent + "  ";
  yield `${error.name}: ${error.message}`;

  // Add custom properties (excluding name, message, stack, and cause)
  const customProps: Record<string, unknown> = {};
  for (const key of Object.keys(error)) {
    if (!["name", "message", "stack", "cause"].includes(key)) {
      customProps[key] = (error as any)[key];
    }
  }

  if (Object.keys(customProps).length > 0) {
    yield "\n" + nextIndent;
    yield* stringifyAnything(seen, customProps, nextIndent, depth + 1);
  }

  // Add stack trace if available
  if (error.stack) {
    const stackLines = error.stack
      .split("\n")
      .map((line) => line.trim())
      .slice(1); // Remove first line as it's typically the error message
    if (stackLines.length > 0) {
      yield "\n" + nextIndent + "Stack trace:";
      for (const line of stackLines) {
        yield "\n" + nextIndent + "  " + line;
      }
    }
  }

  // Handle cause chain with special formatting
  if ("cause" in error && error.cause !== undefined) {
    yield "\n" + nextIndent + "Caused by: ";
    if (error.cause instanceof Error) {
      yield "\n" + nextIndent;
      yield* stringifyErrorObject(error.cause, seen, nextIndent, depth + 1);
    } else {
      yield* stringifyAnything(seen, error.cause, nextIndent, depth + 1);
    }
  }
}

function* stringifyArray(
  arr: unknown[],
  seen: WeakSet<object>,
  indent: string,
  depth: number,
): Generator<string> {
  if (arr.length === 0) {
    yield "[]";
    return;
  }

  const nextIndent = indent + "  ";
  yield "[\n";

  for (let i = 0; i < arr.length; i++) {
    yield nextIndent;
    yield* stringifyAnything(seen, arr[i], nextIndent, depth + 1);
    if (i < arr.length - 1) yield ",\n";
  }

  yield "\n" + indent + "]";
}

function* stringifyObject(
  obj: object,
  seen: WeakSet<object>,
  indent: string,
  depth: number,
): Generator<string> {
  const entries = Object.entries(obj);
  if (entries.length === 0) {
    yield "{}";
    return;
  }

  const nextIndent = indent + "  ";
  yield "{\n";

  for (let i = 0; i < entries.length; i++) {
    const [key, val] = entries[i];
    yield nextIndent;
    yield /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
    yield ": ";
    yield* stringifyAnything(seen, val, nextIndent, depth + 1);
    if (i < entries.length - 1) yield ",\n";
  }

  yield "\n" + indent + "}";
}

function* stringifyMap(
  map: Map<unknown, unknown>,
  seen: WeakSet<object>,
  indent: string,
  depth: number,
): Generator<string> {
  if (map.size === 0) {
    yield "Map{}";
    return;
  }

  const nextIndent = indent + "  ";
  yield "Map{\n";

  const entries = Array.from(map.entries());
  for (let i = 0; i < entries.length; i++) {
    const [key, val] = entries[i];
    yield nextIndent;
    yield* stringifyAnything(seen, key, nextIndent, depth + 1);
    yield " => ";
    yield* stringifyAnything(seen, val, nextIndent, depth + 1);
    if (i < entries.length - 1) yield ",\n";
  }

  yield "\n" + indent + "}";
}

function* stringifySet(
  set: Set<unknown>,
  seen: WeakSet<object>,
  indent: string,
  depth: number,
): Generator<string> {
  if (set.size === 0) {
    yield "Set{}";
    return;
  }

  const nextIndent = indent + "  ";
  yield "Set{\n";

  const values = Array.from(set);
  for (let i = 0; i < values.length; i++) {
    yield nextIndent;
    yield* stringifyAnything(seen, values[i], nextIndent, depth + 1);
    if (i < values.length - 1) yield ",\n";
  }

  yield "\n" + indent + "}";
}
