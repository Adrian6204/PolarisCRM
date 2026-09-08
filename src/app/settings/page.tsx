import { redirect } from "next/navigation";

/** Settings index → first tab. */
export default function SettingsIndex() {
  redirect("/settings/team");
}
