import { getPreferenceValues } from "@raycast/api";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

interface Preferences {
  codexAuthPaths?: string;
}

export interface CodexUsageWindow {
  used_percent: number;
  reset_at: number;
  limit_window_seconds: number;
}

export interface CodexUsageResponse {
  plan_type: string;
  rate_limit?: {
    primary_window?: CodexUsageWindow | null;
    secondary_window?: CodexUsageWindow | null;
  } | null;
}

export interface CodexAccountUsage {
  label: string;
  accountId?: string | null;
  sourcePath: string;
  usage?: CodexUsageResponse;
  error?: string;
}

interface CodexAuthFile {
  tokens?: {
    access_token?: string;
    account_id?: string;
  } | null;
}

function expandPath(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("~/")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }

  return trimmed;
}

function normalizeAuthPath(input: string) {
  const resolved = expandPath(input);
  if (!resolved) {
    return "";
  }

  return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
    ? path.join(resolved, "auth.json")
    : resolved;
}

function discoverProfileAuthPaths(profileRoot: string) {
  if (!fs.existsSync(profileRoot) || !fs.statSync(profileRoot).isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(profileRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(profileRoot, entry.name, "auth.json"))
    .filter((candidate) => fs.existsSync(candidate));
}

export function getCodexAuthPaths() {
  const preferences = getPreferenceValues<Preferences>();
  const configured = (preferences.codexAuthPaths ?? "")
    .split(/[\n,]/)
    .map(normalizeAuthPath)
    .filter(Boolean);

  const codexHome = process.env.CODEX_HOME
    ? normalizeAuthPath(process.env.CODEX_HOME)
    : "";
  const defaultAuth = normalizeAuthPath(path.join(os.homedir(), ".codex", "auth.json"));
  const profileAuths = discoverProfileAuthPaths(
    path.join(os.homedir(), ".codex", "profiles"),
  );

  return Array.from(
    new Set([...configured, codexHome, defaultAuth, ...profileAuths].filter(Boolean)),
  );
}

function readAuthFile(sourcePath: string) {
  const data = fs.readFileSync(sourcePath, "utf8");
  return JSON.parse(data) as CodexAuthFile;
}

export function loadCodexCredentials(sourcePath: string) {
  if (!fs.existsSync(sourcePath)) {
    return { error: `Auth file not found: ${sourcePath}` } as const;
  }

  try {
    const json = readAuthFile(sourcePath);
    const accessToken = json.tokens?.access_token;
    if (!accessToken) {
      return { error: `Missing access token in ${sourcePath}` } as const;
    }

    return {
      accessToken,
      accountId: json.tokens?.account_id ?? null,
    } as const;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Failed to read ${sourcePath}: ${error.message}`
          : `Failed to read ${sourcePath}`,
    } as const;
  }
}

export async function fetchCodexUsage(
  accessToken: string,
  accountId?: string | null,
) {
  const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "ChatGPT-Account-Id": accountId ?? "",
      "User-Agent": "codex-cli",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Codex usage request failed: ${response.statusText}`);
  }

  return (await response.json()) as CodexUsageResponse;
}
