export function recordsToCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const value = row[column];
        const text = value === undefined || value === null ? "" : String(value);
        return `"${text.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
