import { useEffect, useState } from "react";

export function VersionFooter() {
  const [version, setVersion] = useState<string>();

  useEffect(() => {
    let disposed = false;
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) throw new Error("Versione non disponibile");
        return response.json();
      })
      .then((body: { version?: unknown }) => {
        if (!disposed && typeof body.version === "string")
          setVersion(body.version);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);

  return <footer>{version && `Versione ${version}`}</footer>;
}
