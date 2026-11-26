/** Install before React renders so startup errors are included, too. */
export function reportInterfaceErrors(): () => void {
  function report(
    error: unknown,
    fallback = "Errore non gestito dell'interfaccia",
  ) {
    // Browsers use TypeError for fetch failures; those are not application errors.
    if (
      error instanceof TypeError &&
      /^(Failed to fetch|fetch failed|NetworkError when attempting to fetch resource\.?|Load failed)$/.test(
        error.message,
      )
    )
      return;
    void fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error instanceof Error ? error.message : fallback,
        stack: error instanceof Error ? (error.stack ?? "") : "",
      }),
      keepalive: true,
    }).catch(() => {
      // Never report a failed report: the local server may be unavailable.
    });
  }
  const onError = (event: ErrorEvent) => {
    // Resource/network errors have no Error and must not enter the registry.
    if (event.error || event.message) report(event.error, event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => report(event.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
