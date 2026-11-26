import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ReportProvider } from "./components/Report";
import { VersionFooter } from "./components/VersionFooter";
import { WindowGate } from "./components/WindowGate";
import { reportInterfaceErrors } from "./interface-errors";

reportInterfaceErrors();

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root mancante in index.html");

createRoot(root).render(
  <StrictMode>
    <ReportProvider>
      <WindowGate>
        <App />
      </WindowGate>
      <VersionFooter />
    </ReportProvider>
  </StrictMode>,
);
