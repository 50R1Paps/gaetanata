import { screen, within } from "@testing-library/react";
import userEvent, {
  PointerEventsCheckLevel,
  type UserEvent,
} from "@testing-library/user-event";
import type { Patient } from "../patient";

/** Shared by the Schema screen tests, which render <App /> against an
 * in-memory fetch. Fake, anonymous people only: Prova Uno has a complete
 * record, Prova Due lacks weight and height. */
export const patients: Patient[] = [
  {
    id: 1,
    name: "Prova Uno",
    birthDate: "1990-05-10",
    sex: "female",
    weightKg: 60,
    heightCm: 165,
  },
  {
    id: 2,
    name: "Prova Due",
    birthDate: "1985-01-20",
    sex: "male",
    weightKg: null,
    heightCm: null,
  },
];

/** jsdom does not implement native dialog display. */
export function stubDialogs() {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
}

// Every event re-renders the whole Schema: no per-keystroke timers, no
// computed-style walk before each pointer action.
export const setup = () =>
  userEvent.setup({
    delay: null,
    pointerEventsCheck: PointerEventsCheckLevel.Never,
  });

/** Switches to the Schema view first: without a patient it is nearly empty,
 * unlike the plan view with its food list, so the dialog queries stay fast. */
export async function openSchema(user: UserEvent, name: string) {
  await user.click(screen.getByRole("radio", { name: "Schema" }));
  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  const dialog = within(screen.getByRole("dialog"));
  await user.click(
    await dialog.findByRole("button", { name: new RegExp(`^${name}`) }),
  );
  await screen.findByText("Schema caricato.");
  await user.click(dialog.getByRole("button", { name: "Chiudi" }));
}
