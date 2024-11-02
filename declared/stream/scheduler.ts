import type { Duration } from "@declared/duration";
import type { Task } from "./task.ts";

export interface Scheduler {
  asap(task: Task): Disposable;
  delay(task: Task, delay: Duration): Disposable;
  periodic(task: Task, delay: Duration): Disposable;
}
