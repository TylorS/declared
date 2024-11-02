export interface Duration {
  readonly millis: number;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export function millis(millis: number): Duration {
  return {
    millis,
  };
}

export function secs(seconds: number) {
  return millis(seconds * SECOND_MS);
}

export function mins(minutes: number) {
  return millis(minutes * MINUTE_MS);
}

export function hours(hours: number) {
  return millis(hours * HOUR_MS);
}

export function days(days: number) {
  return millis(days * DAY_MS);
}

export function weeks(weeks: number) {
  return millis(weeks * WEEK_MS);
}

export function add(right: Duration) {
  return (left: Duration) => millis(left.millis + right.millis);
}

export function subtract(right: Duration) {
  return (left: Duration) => millis(left.millis - right.millis);
}

export function multiply(right: Duration) {
  return (left: Duration) => millis(left.millis * right.millis);
}

export function divide(right: Duration) {
  return (left: Duration) => millis(left.millis / right.millis);
}
