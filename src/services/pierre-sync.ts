import { refreshPierreBalance, syncPierreRange } from "@/services/pierre";

export async function syncPierreData(
  preferredAccountId?: string | null,
) {
  return syncPierreRange(undefined, undefined, preferredAccountId);
}

export async function refreshPierreData(
  preferredAccountId?: string | null,
) {
  return refreshPierreBalance(preferredAccountId);
}
