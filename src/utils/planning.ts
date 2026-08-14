import type { Recurrence } from "../types";

export function periodIndex(year: number, month: number) {
  return year * 12 + month - 1;
}

function recurrenceStartPeriod(startDate: string) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(startDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function recurrenceExpired(
  recurrence: Recurrence,
  year: number,
  month: number,
) {
  if (!recurrence.limit) return false;
  const start = recurrenceStartPeriod(recurrence.startDate);
  if (!start) return false;
  const diff =
    periodIndex(year, month) -
    periodIndex(start.year, start.month);
  if (diff < 0) return false;
  const occurrence =
    recurrence.period === "monthly"
      ? diff
      : recurrence.period === "quarterly"
        ? Math.floor(diff / 3)
        : Math.floor(diff / 12);
  return occurrence >= recurrence.limit;
}

export function recurrenceStarted(
  recurrence: Recurrence,
  year: number,
  month: number,
) {
  const start = recurrenceStartPeriod(recurrence.startDate);
  if (!start) return false;
  return periodIndex(year, month) >= periodIndex(start.year, start.month);
}

export function recurrenceScheduled(
  recurrence: Recurrence,
  year: number,
  month: number,
) {
  const start = recurrenceStartPeriod(recurrence.startDate);
  if (!start) return false;
  const diff =
    periodIndex(year, month) -
    periodIndex(start.year, start.month);
  if (!recurrenceStarted(recurrence, year, month) || recurrenceExpired(recurrence, year, month)) return false;
  if (recurrence.period === "monthly") return true;
  if (recurrence.period === "quarterly") return diff % 3 === 0;
  return diff % 12 === 0;
}

export function recurrenceDate(
  recurrence: Recurrence,
  year: number,
  month: number,
) {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(recurrence.originalDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
