import { useEffect, useState } from "react";
import { useReport } from "./Report";

export function VersionFooter() {
  const report = useReport();
  const [version, setVersion] = useState<string>();
  const setReportVersion = report?.setVersion;

  useEffect(() => {
    let disposed = false;
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) throw new Error("Versione non disponibile");
        return response.json();
      })
      .then((body: { version?: unknown }) => {
        if (!disposed && typeof body.version === "string") {
          setVersion(body.version);
          setReportVersion?.(body.version);
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [setReportVersion]);

  return (
    <footer>
      {version && `Versione ${version}`}
      <button type="button" onClick={() => report?.openReport()}>
        Segnala problema
      </button>
    </footer>
  );
}
