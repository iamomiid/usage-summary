import { List, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import { CodexAccountUsage } from "./codex-api";
import {
  getCodexPreferences,
  getPredictedRunout,
  getProgressBar,
  getWindowProgress,
  loadCodexAccounts,
} from "./codex-shared";

export default function CodexUsage() {
  const { showPredictedRunoutTime } = getCodexPreferences();
  const [accounts, setAccounts] = useState<CodexAccountUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAccounts() {
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

    loadAccounts();
  }, []);

  return (
    <List isLoading={isLoading}>
      {accounts.length === 0 ? (
        <List.EmptyView
          title="No Codex accounts found"
          description="Set Codex auth paths in the command preferences."
        />
      ) : (
        accounts.map((account) => (
          <List.Section
            key={account.sourcePath}
            title={account.label}
          >
            {account.error ? (
              <List.Item title="Error" subtitle={account.error} icon="⚠️" />
            ) : (
              <>
                {(() => {
                const primaryWindow = getWindowProgress(
                    account.usage?.rate_limit?.primary_window ?? undefined,
                  );
                  const primaryRunout = getPredictedRunout(
                    account.usage?.rate_limit?.primary_window ?? undefined,
                  );
                  return (
                    <List.Item
                      title="5h Limit"
                      subtitle={primaryWindow.subtitle}
                      accessories={[
                        { text: getProgressBar(primaryWindow.progress) },
                        {
                          text: `${Math.round(primaryWindow.progress * 100)}%`,
                        },
                        ...(showPredictedRunoutTime && primaryRunout
                          ? [
                              {
                                text: primaryRunout.label,
                              },
                            ]
                          : []),
                      ]}
                      icon="⏱️"
                    />
                  );
                })()}
                <List.Item
                  title="Weekly Limit"
                  subtitle={getWindowProgress(
                    account.usage?.rate_limit?.secondary_window ?? undefined,
                  ).subtitle}
                  accessories={[
                    ...(showPredictedRunoutTime
                      ? [
                          {
                            text:
                              getPredictedRunout(
                                account.usage?.rate_limit?.secondary_window ??
                                  undefined,
                              )?.label ?? "unavailable",
                          },
                        ]
                      : []),
                    {
                      text: getProgressBar(
                        getWindowProgress(
                          account.usage?.rate_limit?.secondary_window ??
                            undefined,
                        ).progress,
                      ),
                    },
                    {
                      text: `${Math.round(
                        getWindowProgress(
                          account.usage?.rate_limit?.secondary_window ??
                            undefined,
                        ).progress * 100,
                      )}%`,
                    },
                  ]}
                  icon="📅"
                />
              </>
            )}
          </List.Section>
        ))
      )}
    </List>
  );
}
