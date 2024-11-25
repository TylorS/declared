import { Pipeable, pipeArguments } from "@declared/pipeable";

declare global {
  interface String extends Pipeable {}
}

String.prototype.pipe = function pipe(this: string) {
  return pipeArguments(this, arguments);
};

export const split = (separator: string) => (string: string) =>
  string.split(separator);

export const join =
  <const Separator extends string>(separator: Separator) =>
  <const Strings extends readonly string[]>(
    strings: readonly [...Strings],
  ): Join<Strings, Separator> =>
    strings.join(separator) as Join<Strings, Separator>;

export type Join<
  Strings extends readonly string[],
  Separator extends string,
> = Join_<Strings, Separator, "">;

type Join_<
  Strings extends readonly string[],
  Separator extends string,
  Acc extends string,
> = Strings extends
  [infer Head extends string, ...infer Tail extends readonly string[]] ? Join_<
    Tail,
    Separator,
    Tail["length"] extends 0 ? `${Acc}${Head}` : `${Acc}${Head}${Separator}`
  >
  : Acc;

export const trim = (string: string) => string.trim();

export const toLowerCase = <const T extends string>(string: T): Lowercase<T> =>
  string.toLowerCase() as Lowercase<T>;

export const toUpperCase = <const T extends string>(string: T): Uppercase<T> =>
  string.toUpperCase() as Uppercase<T>;

export const replace =
  (searchValue: string, replaceValue: string) => (string: string) =>
    string.replace(searchValue, replaceValue);

export const repeat = (count: number) => (string: string) =>
  string.repeat(count);

export const padStart =
  (targetLength: number) => (padString: string) => (string: string) =>
    string.padStart(targetLength, padString);

export const padEnd =
  (targetLength: number, padString: string) => (string: string) =>
    string.padEnd(targetLength, padString);

export const slice = (start: number, end?: number) => (string: string) =>
  string.slice(start, end);

export const substring = (start: number, end?: number) => (string: string) =>
  string.substring(start, end);

export const charAt = (index: number) => (string: string) =>
  string.charAt(index);

export const charCodeAt = (index: number) => (string: string) =>
  string.charCodeAt(index);

export const fromCharCode = (code: number) => String.fromCharCode(code);

export const fromCodePoint = (codePoint: number) =>
  String.fromCodePoint(codePoint);

export const raw = (strings: TemplateStringsArray, ...values: any[]) =>
  String.raw(strings, ...values);

export const length = (string: string) => string.length;

export const codePointAt = (index: number) => (string: string) =>
  string.codePointAt(index);

export const capitalize = <const T extends string>(string: T): Capitalize<T> =>
  (string.charAt(0).toUpperCase() + string.slice(1)) as Capitalize<T>;

export const uncapitalize = <const T extends string>(
  string: T,
): Uncapitalize<T> =>
  (string.charAt(0).toLowerCase() + string.slice(1)) as Uncapitalize<T>;

export const endsWith =
  (searchString: string, position?: number) => (string: string) =>
    string.endsWith(searchString, position);

export const includes =
  (searchString: string, position?: number) => (string: string) =>
    string.includes(searchString, position);

export const indexOf =
  (searchString: string, position?: number) => (string: string) =>
    string.indexOf(searchString, position);

export const lastIndexOf =
  (searchString: string, position?: number) => (string: string) =>
    string.lastIndexOf(searchString, position);

export const match = (regexp: RegExp) => (string: string) =>
  string.match(regexp);

export const search = (regexp: RegExp) => (string: string) =>
  string.search(regexp);

export const replaceAll =
  (searchValue: string, replaceValue: string) => (string: string) =>
    string.replaceAll(searchValue, replaceValue);

export const splitLines = (string: string) => string.split(/\r?\n/);

export const concat =
  <const B extends string>(second: B) =>
  <const A extends string>(first: A): `${A}${B}` => `${first}${second}`;
