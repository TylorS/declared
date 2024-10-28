export interface Predicate<in A> {
  (a: A): boolean;
}

export interface Refinement<in A, out B extends A> {
  (a: A): a is B;
}
