import type { Task } from "./task.ts";

export interface Scheduler {
  asap(task: Task): Disposable;
  delay(task: Task, delay: number): Disposable;
  periodic(task: Task, delay: number): Disposable;
}
