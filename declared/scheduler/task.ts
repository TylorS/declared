export interface Task {
  run(): void | PromiseLike<unknown>;
  error(error: unknown): void | PromiseLike<unknown>;
}


export const make = (
  run: () => void | PromiseLike<unknown>,
  error: (error: unknown) => void | PromiseLike<unknown>,
): Task => ({
  run,
  error,
});

export function andThen(task: Task, f: () => unknown): Task {
  return {
    async run() {
      await task.run();
      f();
    },
    error(u: unknown) {
      return task.error(u);
    },
  };
}
