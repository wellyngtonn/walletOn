"use client";
export function MonthPicker({
  month,
  year,
  onChange,
}: {
  month: number;
  year: number;
  onChange: (m: number, y: number) => void;
}) {
  const periods = Array.from({ length: 36 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  return (
    <select
      aria-label="Mês e ano"
      className="month-select"
      value={`${month}-${year}`}
      onChange={(e) => {
        const [m, y] = e.target.value.split("-").map(Number);
        onChange(m, y);
      }}
    >
      {periods.map((p) => (
        <option key={`${p.month}-${p.year}`} value={`${p.month}-${p.year}`}>
          {String(p.month).padStart(2, "0")}/{p.year}
        </option>
      ))}
    </select>
  );
}
