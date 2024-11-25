import { Pipeable, pipeArguments } from "@declared/pipeable";

declare global {
  interface Number extends Pipeable {}
}

Number.prototype.pipe = function pipe(this: number) {
  return pipeArguments(this, arguments);
};

export const add = (second: number) => (first: number) => first + second;

export const subtract = (second: number) => (first: number) => first - second;

export const multiply = (second: number) => (first: number) => first * second;

export const divide = (second: number) => (first: number) => first / second;

export const modulo = (second: number) => (first: number) => first % second;

export const negate = (first: number) => -first;

export const increment = (first: number) => first + 1;

export const decrement = (first: number) => first - 1;

export const absolute = (first: number) => Math.abs(first);

export const floorValue = (first: number) => Math.floor(first);

export const ceiling = (first: number) => Math.ceil(first);

export const roundValue = (first: number) => Math.round(first);

export const truncate = (first: number) => Math.trunc(first);

export const sign = (first: number) => Math.sign(first);

export const power = (exponent: number) => (first: number) =>
  Math.pow(first, exponent);

export const squareRoot = (first: number) => Math.sqrt(first);

export const cubeRoot = (first: number) => Math.cbrt(first);

export const logarithm = (first: number) => Math.log(first);

export const exponential = (first: number) => Math.exp(first);

export const exponentialMinus1 = (first: number) => Math.expm1(first);

export const logarithm1Plus = (first: number) => Math.log1p(first);

export const logarithmBase10 = (first: number) => Math.log10(first);

export const logarithmBase2 = (first: number) => Math.log2(first);

export const sine = (first: number) => Math.sin(first);

export const cosine = (first: number) => Math.cos(first);

export const tangent = (first: number) => Math.tan(first);

export const arcSine = (first: number) => Math.asin(first);

export const arcCosine = (first: number) => Math.acos(first);

export const arcTangent = (first: number) => Math.atan(first);

export const arcTangent2 = (second: number) => (first: number) =>
  Math.atan2(first, second);

export const hypotenuse = (...numbers: readonly number[]) =>
  Math.hypot(...numbers);

export const hyperbolicSine = (first: number) => Math.sinh(first);

export const hyperbolicCosine = (first: number) => Math.cosh(first);

export const hyperbolicTangent = (first: number) => Math.tanh(first);

export const arcHyperbolicSine = (first: number) => Math.asinh(first);

export const arcHyperbolicCosine = (first: number) => Math.acosh(first);

export const arcHyperbolicTangent = (first: number) => Math.atanh(first);

export const floatRound = (first: number) => Math.fround(first);

export const integerMultiply = (second: number) => (first: number) =>
  Math.imul(first, second);

export const countLeadingZeros32 = (first: number) => Math.clz32(first);

export const maximum = (...numbers: readonly number[]) => Math.max(...numbers);

export const minimum = (...numbers: readonly number[]) => Math.min(...numbers);

export const EULER_NUMBER = Math.E;
export const NATURAL_LOG_10 = Math.LN10;
export const NATURAL_LOG_2 = Math.LN2;
export const LOG_10_E = Math.LOG10E;
export const LOG_2_E = Math.LOG2E;
export const PI = Math.PI;
export const SQUARE_ROOT_HALF = Math.SQRT1_2;
export const SQUARE_ROOT_TWO = Math.SQRT2;
