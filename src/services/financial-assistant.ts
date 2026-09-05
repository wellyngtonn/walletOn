import { auth } from "@/lib/firebase/config";
import type { Transaction } from "@/types";
import type { PlannedTransaction, Recurrence } from "@/types";

export type AssistantMessage = {
  role: "user" | "model";
  text: string;
};

type AssistantResponse = {
  text: string;
};

const assistantApiUrl =
  process.env.NEXT_PUBLIC_AI_API_URL || "/api/financial-assistant/";

export async function askFinancialAssistant(
  message: string,
  history: AssistantMessage[] = [],
  transactions: Transaction[] = [],
  plans: PlannedTransaction[] = [],
  recurrences: Recurrence[] = [],
) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Faça login para usar o assistente financeiro.");

  const token = await currentUser.getIdToken();
  const result = await fetch(assistantApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: message.trim().slice(0, 2000),
      history: history.slice(-8),
      transactions: transactions
        .filter((transaction) => typeof transaction.pierreId === "string" && transaction.pierreId.trim().length > 0)
        .slice(0, 10000)
        .map((transaction) => ({
          userId: transaction.userId,
          type: transaction.type,
          description: transaction.description,
          category: transaction.category || "Outros",
          amount: transaction.amount,
          date: transaction.date,
        })),
      plans: plans.slice(0, 5000).map((plan) => ({
        userId: plan.userId,
        type: plan.type,
        description: plan.description,
        category: plan.category,
        amount: plan.amount,
        date: plan.date,
        paid: plan.paid === true,
      })),
      recurrences: recurrences.slice(0, 5000).map((recurrence) => ({
        userId: recurrence.userId,
        type: recurrence.type,
        description: recurrence.description,
        category: recurrence.category,
        amount: recurrence.amount,
        startDate: recurrence.startDate,
        period: recurrence.period,
        limit: recurrence.limit,
        paid: recurrence.paid === true,
      })),
    }),
  });

  const data = (await result.json().catch(() => null)) as AssistantResponse | { error?: string } | null;
  if (!result.ok) {
    throw new Error(data && "error" in data && data.error ? data.error : "Não foi possível consultar o assistente.");
  }
  if (!data || !("text" in data) || typeof data.text !== "string") {
    throw new Error("Resposta inválida do assistente.");
  }
  return data;
}
