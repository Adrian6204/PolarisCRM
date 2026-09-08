import { SettingsTabs } from "./settings-tabs";

/** Shared chrome for the settings area: heading + tab navigation. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <SettingsTabs />
      {children}
    </div>
  );
}
