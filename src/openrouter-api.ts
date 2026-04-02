import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  openrouterApiKey: string;
}

interface CreditsResponse {
  data: {
    total_credits?: number | null;
    total_usage?: number | null;
  };
}

interface ActivityDataPoint {
  id?: string | null;
  model?: string | null;
  model_name?: string | null;
  model_permaslug?: string | null;
  provider_name?: string | null;
  date?: string | null;
  endpoint_id?: string | null;
  endpoint?: string | null;
  is_byok?: boolean | null;
  usage?: number | null;
  byok_usage_inference?: number | null;
  total_prompt_tokens?: number | null;
  total_completion_tokens?: number | null;
  total_requests?: number | null;
  requests?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  reasoning_tokens?: number | null;
  cost?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ActivityResponse {
  data: ActivityDataPoint[];
}

export async function getCredits(): Promise<CreditsResponse> {
  const preferences = getPreferenceValues<Preferences>();

  const response = await fetch("https://openrouter.ai/api/v1/credits", {
    headers: {
      Authorization: `Bearer ${preferences.openrouterApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch credits: ${response.statusText}`);
  }

  return (await response.json()) as CreditsResponse;
}

export async function getActivity(): Promise<ActivityResponse> {
  const preferences = getPreferenceValues<Preferences>();

  const response = await fetch("https://openrouter.ai/api/v1/activity", {
    headers: {
      Authorization: `Bearer ${preferences.openrouterApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activity: ${response.statusText}`);
  }

  return (await response.json()) as ActivityResponse;
}

export type { CreditsResponse, ActivityResponse, ActivityDataPoint };
