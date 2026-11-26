import type { ReactNode } from "react";
import type { FailedUpdate } from "../update";
import { useReport } from "./Report";

/** Only diagnostic text belongs in message, never patient values or filenames. */
export function ErrorMessage({
  message,
  children,
  as: Tag = "p",
  className = "error",
  failedUpdate,
  reportable = true,
}: {
  message: string;
  children?: ReactNode;
  as?: "p" | "div";
  className?: string;
  failedUpdate?: FailedUpdate | undefined;
  reportable?: boolean;
}) {
  const report = useReport();
  return (
    <Tag role="alert" className={className}>
      {Tag === "div" ? <p>{message}</p> : message}
      {children}
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
