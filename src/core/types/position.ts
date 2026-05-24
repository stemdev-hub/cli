// TODO: Define unist-compatible source position primitives used by parser diagnostics.
export interface Point {
  line: number;
  column: number;
  offset?: number;
}

export interface Position {
  start: Point;
  end: Point;
  indent?: number[];
}
