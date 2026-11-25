export type UpdateState =
  | { status: "idle" }
  | {
      status: "available";
      version: string;
      notes: string;
      zipUrl?: string;
      failedMessage?: string;
      failedFrom?: string;
      failedVersion?: string;
    }
  | {
      status: "progress";
      step: "scarico" | "installo" | "preparo" | "riavvio";
      from: string;
      version: string;
    }
  | { status: "failed"; message: string; from?: string; version?: string };
