export type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string; notes: string };
