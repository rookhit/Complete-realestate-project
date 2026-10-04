// The admin-editable dropdown lists (backend-realstate/app/api/v1/site/options, …/admin/site/options).
import { authFetch } from "@/app/auth";

/** Every list the admin has saved, by key (lists never saved are left out). Public. */
export async function fetchSavedOptions(): Promise<Record<string, string[]>> {
  return (await authFetch<{ data: Record<string, string[]> }>("/site/options")).data;
}

/** Replace one list; resolves to the list as stored (trimmed, duplicates dropped). Admin only. */
export async function saveOptionList(key: string, items: string[]): Promise<string[]> {
  const res = await authFetch<{ data: { key: string; items: string[] } }>(`/admin/site/options/${encodeURIComponent(key)}`, {
    method: "PUT", body: JSON.stringify({ items }),
  });
  return res.data.items;
}
