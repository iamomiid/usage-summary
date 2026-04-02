import { getPreferenceValues, List, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import {
  CodexAccountUsage,
  fetchCodexUsage,
  getCodexAuthPaths,
  loadCodexCredentials,
} from "./codex-api";

function formatResetTime(resetAt: number) {
  const diffMs = resetAt * 1000 - Date.now();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `resets in ${diffMinutes}m`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `resets in ${diffHours}h`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `resets in ${diffDays}d`;
}

function getWindowProgress(window?: {
  used_percent: number;
  reset_at: number;
  limit_window_seconds: number;
}) {
  if (!window) {
    return {
      progress: 0,
      subtitle: "Unavailable",
    };
  }

  return {
    progress: Math.max(0, Math.min(1, window.used_percent / 100)),
    subtitle: `${window.used_percent}% used • ${formatResetTime(window.reset_at)}`,
  };
}

function getProgressBar(progress: number) {
  const filled = Math.max(0, Math.min(10, Math.round(progress * 10)));
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

function formatRelativeDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.round(hours / 24)}d`;
}

function getPredictedRunout(window?: {
  used_percent: number;
  reset_at: number;
  limit_window_seconds: number;
}) {
  if (!window || window.used_percent <= 0) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = Math.max(0, window.reset_at - now);
  const elapsedSeconds = Math.max(
    0,
    window.limit_window_seconds - remainingSeconds,
  );

  if (elapsedSeconds <= 0) {
    return null;
  }

  const remainingToLimitSeconds =
    (elapsedSeconds * (100 - window.used_percent)) / window.used_percent;
  const predictedRunoutAt = now + remainingToLimitSeconds;
  const isDeficit = predictedRunoutAt < window.reset_at;

  return {
    predictedRunoutAt,
    isDeficit,
    label: isDeficit
      ? `⚠️ runout in ${formatRelativeDuration(predictedRunoutAt - now)}`
      : "safe until reset",
  };
}

export default function CodexUsage() {
  const { showPredictedRunoutTime } = getPreferenceValues<{
    showPredictedRunoutTime?: boolean;
  }>();
  const [accounts, setAccounts] = useState<CodexAccountUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const paths = getCodexAuthPaths();
        if (paths.length === 0) {
          setAccounts([]);
          return;
        }

        const results = await Promise.all(
          paths.map(async (sourcePath) => {
            const credentials = loadCodexCredentials(sourcePath);
            if ("error" in credentials) {
              return {
                label: sourcePath,
                sourcePath,
                error: credentials.error,
              } satisfies CodexAccountUsage;
            }

            try {
              const usage = await fetchCodexUsage(
                credentials.accessToken,
                credentials.accountId,
              );
              return {
                label: sourcePath,
                accountId: credentials.accountId,
                sourcePath,
                usage,
              } satisfies CodexAccountUsage;
            } catch (error) {
              return {
                label: sourcePath,
                accountId: credentials.accountId,
                sourcePath,
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to fetch Codex usage",
              } satisfies CodexAccountUsage;
            }
          }),
        );

        setAccounts(results);
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
