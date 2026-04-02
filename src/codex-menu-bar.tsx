import { Color, Icon, MenuBarExtra, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import {
  getCachedCodexAccounts,
  formatResetTime,
  getCodexPreferences,
  getPredictedRunout,
  getProgressBar,
  getWindowProgress,
  loadCodexAccounts,
} from "./codex-shared";
import { CodexAccountUsage } from "./codex-api";

export default function CodexMenuBar() {
  const { showPredictedRunoutTime } = getCodexPreferences();
  const initialAccounts = getCachedCodexAccounts();
  const [accounts, setAccounts] = useState<CodexAccountUsage[]>(
    initialAccounts ?? [],
  );
  const [isLoading, setIsLoading] = useState(!initialAccounts);

  useEffect(() => {
    async function load() {
      try {
        setAccounts(await loadCodexAccounts());
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load Codex accounts",
        });
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  return (
    <MenuBarExtra
      icon={{ source: Icon.Terminal, tintColor: Color.PrimaryText }}
      tooltip="Codex Usage"
    >
      {isLoading ? (
        <MenuBarExtra.Item title="Refreshing Codex cache..." />
      ) : null}
      {!isLoading && accounts.length === 0 ? (
        <MenuBarExtra.Item title="No Codex accounts found" />
      ) : null}
      {accounts.map((account) => {
        if (account.error) {
          return (
            <MenuBarExtra.Section key={account.sourcePath} title={account.label}>
              <MenuBarExtra.Item title="Error" subtitle={account.error} />
            </MenuBarExtra.Section>
          );
        }

        const primary = getWindowProgress(
          account.usage?.rate_limit?.primary_window ?? undefined,
        );
        const weekly = getWindowProgress(
          account.usage?.rate_limit?.secondary_window ?? undefined,
        );
        const primaryRunout = getPredictedRunout(
          account.usage?.rate_limit?.primary_window ?? undefined,
        );
        const weeklyRunout = getPredictedRunout(
          account.usage?.rate_limit?.secondary_window ?? undefined,
        );

        return (
          <MenuBarExtra.Section key={account.sourcePath} title={account.label}>
            <MenuBarExtra.Item
              title={`5h ${Math.round(primary.progress * 100)}% ${getProgressBar(primary.progress)}`}
              subtitle={primary.subtitle}
              icon={{ source: Icon.Circle, tintColor: primary.progress > 0.8 ? Color.Red : Color.Green }}
              onAction={() => {}}
            />
            <MenuBarExtra.Item
              title={`Weekly ${Math.round(weekly.progress * 100)}% ${getProgressBar(weekly.progress)}`}
              subtitle={weekly.subtitle}
              icon={{ source: Icon.Circle, tintColor: weekly.progress > 0.8 ? Color.Red : Color.Green }}
              onAction={() => {}}
            />
            {showPredictedRunoutTime && primaryRunout ? (
              <MenuBarExtra.Item title="5h Runout" subtitle={primaryRunout.label} onAction={() => {}} />
            ) : null}
            {showPredictedRunoutTime && weeklyRunout ? (
              <MenuBarExtra.Item title="Weekly Runout" subtitle={weeklyRunout.label} onAction={() => {}} />
            ) : null}
            <MenuBarExtra.Item
              title="Reset"
              subtitle={`${formatResetTime(account.usage?.rate_limit?.primary_window?.reset_at ?? 0)} / ${formatResetTime(account.usage?.rate_limit?.secondary_window?.reset_at ?? 0)}`}
              onAction={() => {}}
            />
          </MenuBarExtra.Section>
        );
      })}
    </MenuBarExtra>
  );
}
