export type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string; notes: string; zipUrl?: string }
  | {
      status: "progress";
      step: "scarico" | "installo" | "preparo" | "riavvio";
      from: string;
      version: string;
    }
  | { status: "failed"; message: string };
