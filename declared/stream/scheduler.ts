import type { Duration } from "@declared/duration";
import * as Task from "./task.ts";
import * as D from "@declared/disposable";

export interface Scheduler {
  asap(task: Task.Task): Disposable;
  delay(task: Task.Task, delay: Duration): Disposable;
  periodic(task: Task.Task, delay: Duration): Disposable;
}

export interface Timer {
  scheduleTask(task: Task.Task, delay: Duration): Disposable;
}

export const DefaultTimer: Timer = {
  scheduleTask: (task, delay) => {
    const id = setTimeout(() => tryRunTask(task), delay.millis);
    return D.sync(() => clearTimeout(id));
  },
};

function tryRunTask(task: Task.Task) {
  try {
    task.run();
  } catch (e) {
    task.error(e);
  }
}

export function makeScheduler(timer: Timer = DefaultTimer): Scheduler {
  return {
    asap: runAsap,
    delay: (task, delay) => timer.scheduleTask(task, delay),
    periodic: (task, delay) => {
      let disposable: Disposable | null = null;
      const rescheduleTask = Task.andThen(task, scheduleNext);

      scheduleNext();

      return D.sync(() => disposable !== null && D.syncDispose(disposable));

      function scheduleNext() {
        disposable = timer.scheduleTask(rescheduleTask, delay);
      }
    },
  };
}

function runAsap(task: Task.Task) {
  let disposed = false;

  queueMicrotask(() => {
    if (disposed) return;
    tryRunTask(task);
  });

  return D.sync(() => disposed = true);
}

export interface VirtualTimer extends Timer {
  readonly progressTimeBy: (duration: Duration) => void;
}

export interface VirtualScheduler extends Scheduler {
  readonly progressTimeBy: (duration: Duration) => void;
}

export function makeVirtualTimer(): VirtualTimer {
  let currentTimeMillis = 0;
  const tasks: VirtualTask[] = [];

  function scheduleTask(task: Task.Task, delay: Duration) {
    // Sort tasks by run time to ensure proper ordering
    const runAt = currentTimeMillis + delay.millis;
    const newTask = { task, runAt };

    let left = 0;
    let right = tasks.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (tasks[mid].runAt > runAt) {
        right = mid;
      } else {
        left = mid + 1;
      }
    }

    tasks.splice(left, 0, newTask);

    return D.sync(() => {
      const index = tasks.findIndex((t) => t.task === task);
      if (index !== -1) tasks.splice(index, 1);
    });
  }

  function runReadyTasks() {
    while (tasks.length > 0 && tasks[0].runAt <= currentTimeMillis) {
      const { task } = tasks.shift()!;
      tryRunTask(task);
    }
  }

  function progressTimeBy(duration: Duration) {
    currentTimeMillis += duration.millis;
    runReadyTasks();
  }

  return {
    scheduleTask,
    progressTimeBy,
  };
}

type VirtualTask = {
  task: Task.Task;
  runAt: number;
};

export function makeVirtualScheduler(
  timer: VirtualTimer = makeVirtualTimer(),
): VirtualScheduler {
  return {
    ...makeScheduler(timer),
    progressTimeBy: timer.progressTimeBy,
  };
}
