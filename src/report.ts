import type { Installation } from "./update.ts";

export type ErrorOrigin = "server" | "interfaccia" | "aggiornamento";
export type ErrorEntry = {
  date: string;
  origin: ErrorOrigin;
  message: string;
  stack: string;
};

export type TechnicalData = {
  version: string;
  system: string;
  installation: Installation;
  errors: ErrorEntry[];
};

export const reportScreens = {
  plan: "Piano settimanale",
  schema: "Schema",
  waiting: "Finestra non attiva",
  closed: "Server non disponibile",
  pending: "Apertura di Gaetanata",
  update: "Aggiornamento",
} as const;
export type ReportScreenName = keyof typeof reportScreens;
