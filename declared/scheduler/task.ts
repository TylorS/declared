export interface Task {
  run(): void;
  error(error: unknown): void;
}

export function andThen(task: Task, f: () => void): Task {
  return {
    run() {
      task.run();
      f();
    },
    error(u: unknown) {
      task.error(u);
    },
  };
}
