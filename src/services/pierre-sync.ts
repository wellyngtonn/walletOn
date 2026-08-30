import { syncPierreRange } from "@/services/pierre";

export async function syncPierreData(
  preferredAccountId?: string | null,
) {
  return syncPierreRange(undefined, undefined, preferredAccountId);
}
