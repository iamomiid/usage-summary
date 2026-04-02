import { List, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import {
  getCredits,
  getActivity,
  CreditsResponse,
  ActivityResponse,
} from "./openrouter-api";

function toSafeNumber(value: number | null | undefined) {
  return typeof value === "number" ? value : 0;
}

function getRequestCount(item: ActivityResponse["data"][number]) {
  return toSafeNumber(item.total_requests ?? item.requests);
}

function getPromptTokens(item: ActivityResponse["data"][number]) {
  return toSafeNumber(item.total_prompt_tokens ?? item.prompt_tokens);
}

function getCompletionTokens(item: ActivityResponse["data"][number]) {
  return toSafeNumber(item.total_completion_tokens ?? item.completion_tokens);
}

function getTotalTokens(item: ActivityResponse["data"][number]) {
  return getPromptTokens(item) + getCompletionTokens(item);
}

function getCost(item: ActivityResponse["data"][number]) {
  return toSafeNumber(item.usage ?? item.cost);
}

export default function OpenRouterSummary() {
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [creditsData, activityData] = await Promise.all([
          getCredits(),
          getActivity(),
        ]);
        setCredits(creditsData);
        setActivity(activityData);
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message:
            error instanceof Error ? error.message : "Failed to fetch data",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const totalCredits = toSafeNumber(credits?.data.total_credits);
  const totalUsage = toSafeNumber(credits?.data.total_usage);
  const remainingCredits = totalCredits - totalUsage;

  // Calculate totals from activity
  const totalPromptTokens =
    activity?.data.reduce((sum, item) => sum + getPromptTokens(item), 0) ?? 0;
  const totalCompletionTokens =
    activity?.data.reduce((sum, item) => sum + getCompletionTokens(item), 0) ??
    0;
  const totalRequests =
    activity?.data.reduce((sum, item) => sum + getRequestCount(item), 0) ?? 0;
  const totalCost =
    activity?.data.reduce((sum, item) => sum + getCost(item), 0) ?? 0;

  const activityByModel = activity?.data.reduce<
    Array<{
      key: string;
      title: string;
      requests: number;
      cost: number;
      totalTokens: number;
    }>
  >((groups, item) => {
    const key = item.model_permaslug || item.model || item.model_name || "unknown";
    const existingGroup = groups.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.requests += getRequestCount(item);
      existingGroup.cost += getCost(item);
      existingGroup.totalTokens += getTotalTokens(item);
      return groups;
    }

    groups.push({
      key,
      title: item.model_name || item.model || "Unknown Model",
      requests: getRequestCount(item),
      cost: getCost(item),
      totalTokens: getTotalTokens(item),
    });

    return groups;
  }, [])?.sort((a, b) => b.cost - a.cost);

  return (
    <List isLoading={isLoading}>
      <List.Section title="Credits">
        <List.Item
          title="Remaining Credits"
          subtitle={`$${remainingCredits.toFixed(4)}`}
          icon="💰"
        />
        <List.Item
          title="Total Credits"
          subtitle={`$${totalCredits.toFixed(4)}`}
          icon="🏦"
        />
        <List.Item
          title="Total Usage"
          subtitle={`$${totalUsage.toFixed(4)}`}
          icon="📊"
        />
      </List.Section>

      <List.Section title="30-Day Activity Summary">
        <List.Item
          title="Total Requests"
          subtitle={totalRequests.toLocaleString()}
          icon="🔄"
        />
        <List.Item
          title="Prompt Tokens"
          subtitle={totalPromptTokens.toLocaleString()}
          icon="📝"
        />
        <List.Item
          title="Completion Tokens"
          subtitle={totalCompletionTokens.toLocaleString()}
          icon="💬"
        />
        <List.Item
          title="Total Cost"
          subtitle={`$${totalCost.toFixed(4)}`}
          icon="💸"
        />
      </List.Section>

      {activityByModel && activityByModel.length > 0 && (
        <List.Section title="By Model">
          {activityByModel.map((item) => (
            <List.Item
              key={item.key}
              title={item.title}
              accessories={[
                { text: `${item.requests} reqs` },
                { text: `$${item.cost.toFixed(4)}` },
                { text: `${item.totalTokens.toLocaleString()} tokens` },
              ]}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}
