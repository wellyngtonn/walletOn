import assert from "node:assert/strict";
import test from "node:test";
import type { Recurrence } from "../src/types";
import {
  recurrenceDate,
  recurrenceExpired,
  recurrenceScheduled,
} from "../src/utils/planning";

function recurrence(
  overrides: Partial<Recurrence> = {},
): Recurrence {
  return {
    id: "r1",
    userId: "u1",
    type: "expense",
    description: "Conta",
    amount: 100,
    startDate: "2026-01-31",
    originalDay: 31,
    category: "Contas",
    period: "monthly",
    ...overrides,
  };
}

test("recorrência mensal ajusta o dia para o último dia do mês", () => {
  assert.equal(recurrenceScheduled(recurrence(), 2026, 2), true);
  assert.equal(recurrenceDate(recurrence(), 2026, 2), "2026-02-28");
});

test("recorrência trimestral só agenda os meses corretos", () => {
  const item = recurrence({ period: "quarterly", startDate: "2026-01-10", originalDay: 10 });
  assert.equal(recurrenceScheduled(item, 2026, 1), true);
  assert.equal(recurrenceScheduled(item, 2026, 2), false);
  assert.equal(recurrenceScheduled(item, 2026, 4), true);
});

test("limite encerra a recorrência após o número de ocorrências", () => {
  const item = recurrence({ limit: 2 });
  assert.equal(recurrenceExpired(item, 2026, 1), false);
  assert.equal(recurrenceExpired(item, 2026, 2), false);
  assert.equal(recurrenceExpired(item, 2026, 3), true);
  assert.equal(recurrenceScheduled(item, 2026, 3), false);
});
