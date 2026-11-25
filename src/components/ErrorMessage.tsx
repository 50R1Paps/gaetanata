import type { ReactNode } from "react";
import { type FailedUpdate, useReport } from "./Report";

/** Only diagnostic text belongs in message, never patient values or filenames. */
export function ErrorMessage({
  message,
  children,
  as: Tag = "p",
  className = "error",
  id,
  failedUpdate,
  reportable = true,
}: {
  message: string;
  children?: ReactNode;
  as?: "p" | "div" | "span";
  className?: string;
  id?: string;
  failedUpdate?: FailedUpdate | undefined;
  reportable?: boolean;
}) {
  const report = useReport();
  return (
    <Tag role="alert" className={className} id={id}>
      {children ?? message}
      {report && reportable && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => report.openReport(message, failedUpdate)}
          >
            Segnala problema
          </button>
        </>
      )}
    </Tag>
  );
}
