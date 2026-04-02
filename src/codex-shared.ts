import { Cache, getPreferenceValues } from "@raycast/api";
import {
  CodexAccountUsage,
  fetchCodexUsage,
  getCodexAuthPaths,
  loadCodexCredentials,
} from "./codex-api";

interface Preferences {
  showPredictedRunoutTime?: boolean;
}

const CODEX_CACHE_KEY = "codex-usage-cache:v1";
const CODEX_CACHE_TTL_MS = 60 * 1000;
const codexCache = new Cache({ namespace: "usage-summary-codex" });

interface CodexUsageCacheEntry {
  savedAt: number;
  pathsKey: string;
  accounts: CodexAccountUsage[];
}

export function getCodexPreferences() {
  return getPreferenceValues<Preferences>();
}

function buildPathsKey(paths: string[]) {
  return paths.join("|");
}

export function getCodexCacheKey() {
  return buildPathsKey(getCodexAuthPaths());
}

export function getCachedCodexAccounts() {
  const pathsKey = getCodexCacheKey();
  const raw = codexCache.get(CODEX_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const entry = JSON.parse(raw) as CodexUsageCacheEntry;
    if (entry.pathsKey !== pathsKey) {
      return null;
    }

    return entry.accounts;
  } catch {
    return null;
  }
}

async function readCodexCache(pathsKey: string) {
  const raw = codexCache.get(CODEX_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const entry = JSON.parse(raw) as CodexUsageCacheEntry;
    if (entry.pathsKey !== pathsKey) {
      return null;
    }

    return entry.accounts;
  } catch {
    return null;
  }
}

async function writeCodexCache(pathsKey: string, accounts: CodexAccountUsage[]) {
  const entry: CodexUsageCacheEntry = {
    savedAt: Date.now(),
    pathsKey,
    accounts,
  };

  codexCache.set(CODEX_CACHE_KEY, JSON.stringify(entry));
}

export function formatResetTime(resetAt: number) {
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

export function getWindowProgress(window?: {
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

export function getProgressBar(progress: number) {
  const filled = Math.max(0, Math.min(10, Math.round(progress * 10)));
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

export function formatRelativeDuration(seconds: number) {
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

export function getPredictedRunout(window?: {
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

export async function loadCodexAccounts(
  forceRefresh = false,
): Promise<CodexAccountUsage[]> {
  const paths = getCodexAuthPaths();
  if (paths.length === 0) {
    return [];
  }

  const pathsKey = buildPathsKey(paths);
  const cachedAccounts = await readCodexCache(pathsKey);
  const cachedEntryRaw = codexCache.get(CODEX_CACHE_KEY);
  if (!forceRefresh && cachedAccounts && cachedEntryRaw) {
    try {
      const cachedEntry = JSON.parse(cachedEntryRaw) as CodexUsageCacheEntry;
      if (Date.now() - cachedEntry.savedAt <= CODEX_CACHE_TTL_MS) {
        return cachedAccounts;
      }
    } catch {
      // fall through and refresh
    }
  }

  const accounts = await Promise.all(
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

  await writeCodexCache(pathsKey, accounts);
  return accounts;
}
