import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type TechnicalData = {
  version: string;
  system?: string;
  installation?: "clone" | "ZIP";
  errors: { date: string; origin: string; message: string; stack: string }[];
};

const recipient = "gaetanata.qualify006@simplelogin.com";

export type FailedUpdate = { from?: string; version: string };

function reportText(
  data: TechnicalData,
  description: string,
  screen: string,
  initialError?: string,
  failedUpdate?: FailedUpdate,
) {
  const subject = `Segnalazione Gaetanata ${data.version}`;
  const mailto = (body: string) =>
    `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const details = [
    ...(data.system ? [`Sistema operativo: ${data.system}`] : []),
    ...(data.installation ? [`Installazione: ${data.installation}`] : []),
    `Schermata: ${screen}`,
  ];
  const base = () =>
    `${description}\n\nDati tecnici\nVersione: ${data.version}${failedUpdate ? `\nVersione installata: ${failedUpdate.from ?? data.version}\nVersione non riuscita: ${failedUpdate.version}` : ""}${details.length ? `\n${details.join("\n")}` : ""}`;
  const errors = [
    ...(initialError ? [`Errore di partenza: ${initialError}`] : []),
    ...(data.errors.length
      ? [
          `Ultimi errori:\n${data.errors.map((entry) => `${entry.date} [${entry.origin}] ${entry.message}\n${entry.stack}`).join("\n\n")}`,
        ]
      : []),
  ].join("\n\n");
  let body = base() + (errors ? `\n\n${errors}` : "");
  if (mailto(body).length <= 2000)
    return { subject, body, mailto: mailto(body) };
  // Only diagnostics are expendable. Even an oversized description stays whole.
  const marker = "\n\n[Errori tagliati]";
  while (
    details.length &&
    mailto(base() + (errors ? marker : "")).length > 2000
  )
    details.pop();
  body = base();
  if (errors && mailto(body + marker).length <= 2000) {
    const characters = Array.from(errors);
    let low = 0;
    let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (
        mailto(`${body}\n\n${characters.slice(0, middle).join("")}${marker}`)
          .length <= 2000
      )
        low = middle;
      else high = middle - 1;
    }
    body += (low ? `\n\n${characters.slice(0, low).join("")}` : "") + marker;
  }
  return { subject, body, mailto: mailto(body) };
}

type ReportSession = {
  openReport: (initialError?: string, failedUpdate?: FailedUpdate) => void;
  setScreen: (screen: string) => void;
  setVersion: (version: string) => void;
};
const ReportContext = createContext<ReportSession | null>(null);

export function useReport() {
  return useContext(ReportContext);
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<{
    screen: string;
    initialError?: string;
    failedUpdate?: FailedUpdate;
  } | null>(null);
  const [screen, setScreen] = useState("Finestra non attiva");
  const [version, setVersion] = useState<string>();
  return (
    <ReportContext
      value={{
        openReport: (initialError, failedUpdate) =>
          setReport({
            screen,
            ...(initialError ? { initialError } : {}),
            ...(failedUpdate ? { failedUpdate } : {}),
          }),
        setScreen,
        setVersion,
      }}
    >
      {children}
      {report && <ReportScreen {...report} version={version} close={() => setReport(null)} />}
    </ReportContext>
  );
}

function ReportScreen({
  screen,
  initialError,
  failedUpdate,
  close,
  version,
}: {
  screen: string;
  initialError?: string;
  failedUpdate?: FailedUpdate;
  close: () => void;
  version: string | undefined;
}) {
  const [data, setData] = useState<TechnicalData | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    fetch("/api/report", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Dati tecnici non disponibili");
        return response.json();
      })
      .then((body: TechnicalData) => {
        if (!controller.signal.aborted) setData(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setUnavailable(true);
          setData({ version: version ?? "Non disponibile", errors: [] });
        }
      });
    return () => controller.abort();
  }, [version]);
  const { subject, body, mailto } = data
    ? reportText(data, description, screen, initialError, failedUpdate)
    : { subject: "", body: "", mailto: "" };
  async function send(method: "gmail" | "mail" | "copy") {
    if (!description.trim()) {
      setMessage("Descrivi cosa è successo o cosa ti serve.");
      return;
    }
    if (method === "gmail") {
      window.open(
        `https://mail.google.com/mail/?view=cm&to=${recipient}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else if (method === "mail") {
      window.open(mailto, "_self");
    } else {
      try {
        await navigator.clipboard.writeText(body);
        setMessage("Testo copiato negli appunti.");
      } catch {
        setMessage(
          "Impossibile copiare il testo. Seleziona e copia l’anteprima.",
        );
      }
    }
  }
  return (
    <dialog
      ref={dialog}
      onCancel={close}
      aria-labelledby="report-title"
      className="report-screen"
    >
      <h2 id="report-title">Segnala problema</h2>
      <p>
        Non inserire nomi o dati dei pazienti. Il messaggio verrà inviato solo
        da te.
      </p>
      <label>
        Cosa è successo o cosa ti serve?
        <textarea
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setMessage("");
          }}
          required
        />
      </label>
      {data ? (
        <>
          <p>Oggetto: Segnalazione Gaetanata {data.version}</p>
          <section aria-label="Anteprima della segnalazione">
            <pre>{body}</pre>
          </section>
        </>
      ) : (
        <p>Lettura dei dati tecnici…</p>
      )}
      {unavailable && <p>Dati tecnici non disponibili. Puoi inviare comunque la segnalazione.</p>}
      {message && <p role="status">{message}</p>}
      <div className="report-actions">
        <button
          type="button"
          className="primary"
          disabled={!data}
          onClick={() => void send("gmail")}
        >
          Invia con Gmail
        </button>
        <button
          type="button"
          disabled={!data}
          onClick={() => void send("mail")}
        >
          Invia con il programma di posta
        </button>
        <button
          type="button"
          disabled={!data}
          onClick={() => void send("copy")}
        >
          Copia il testo
        </button>
        <button type="button" onClick={close}>
          Chiudi
        </button>
      </div>
    </dialog>
  );
}
