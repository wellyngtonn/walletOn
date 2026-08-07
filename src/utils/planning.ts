import type { Recurrence } from "../types";

export function periodIndex(year: number, month: number) {
  return year * 12 + month - 1;
}

export function recurrenceExpired(
  recurrence: Recurrence,
  year: number,
  month: number,
) {
  if (!recurrence.limit) return false;
  const start = new Date(`${recurrence.startDate}T12:00:00`);
  const diff =
    periodIndex(year, month) -
    periodIndex(start.getFullYear(), start.getMonth() + 1);
  if (diff < 0) return false;
  const occurrence =
    recurrence.period === "monthly"
      ? diff
      : recurrence.period === "quarterly"
        ? Math.floor(diff / 3)
        : Math.floor(diff / 12);
  return occurrence >= recurrence.limit;
}

export function recurrenceScheduled(
  recurrence: Recurrence,
  year: number,
  month: number,
) {
  const start = new Date(`${recurrence.startDate}T12:00:00`);
  const diff =
    periodIndex(year, month) -
    periodIndex(start.getFullYear(), start.getMonth() + 1);
  if (diff < 0 || recurrenceExpired(recurrence, year, month)) return false;
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
