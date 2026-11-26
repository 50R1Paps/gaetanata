export type Installation = "clone" | "ZIP";

/** Either version may be unknown to an older launcher or a disconnected client. */
export type FailedUpdate = { installed?: string; attempted?: string };

export type UpdateState =
  | { status: "idle" }
  | {
      status: "available";
      version: string;
      notes: string;
      zipUrl?: string;
      failedMessage?: string;
      failedUpdate?: FailedUpdate | undefined;
    }
  | {
      status: "progress";
      step: "scarico" | "installo" | "preparo" | "riavvio";
      from: string;
      version: string;
    }
  | {
      status: "failed";
      message: string;
      failedUpdate?: FailedUpdate | undefined;
    };

export function failedUpdateFromEnvironment(
  env: Record<string, string | undefined>,
): FailedUpdate | undefined {
  const installed = env.GAETANATA_AGGIORNAMENTO_FALLITO;
  const attempted = env.GAETANATA_AGGIORNAMENTO_VERSIONE_TENTATA;
  return installed
    ? { installed, ...(attempted ? { attempted } : {}) }
    : undefined;
}
