import type { BankProvider } from "@/utils/bank";
import { syncPierreRange } from "@/services/pierre";
import { syncPluggyRange } from "@/services/pluggy";

export interface BankSyncResult {
  imported: number;
}

export async function syncBankData(
  provider: BankProvider | null,
  options: {
    fromDate?: string;
    toDate?: string;
    preferredAccountId?: string | null;
    manualUpdate?: boolean;
  } = {},
): Promise<BankSyncResult> {
  if (provider === "pluggy") {
    const result = await syncPluggyRange(
      options.fromDate,
      options.toDate,
      options.preferredAccountId,
    );
    return { imported: result.imported };
  }
  if (provider === "pierre") {
    const result = await syncPierreRange(
      options.fromDate,
      options.toDate,
      options.preferredAccountId,
      options.manualUpdate === true,
    );
    return { imported: result.imported };
  }
  return { imported: 0 };
}
