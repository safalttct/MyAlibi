export type CsvCell = string | number | boolean | null | undefined;

/**
 * Minimal RFC-4180 style parser: quoted fields, escaped quotes (`""`),
 * embedded commas/newlines, CRLF/LF, optional BOM. Fully blank lines are skipped.
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;

  const endField = (): void => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRow = (): void => {
    endField();
    if (!(row.length === 1 && row[0] === '')) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        i++;
      }
      endRow();
    } else if (ch === '\n') {
      endRow();
    } else {
      field += ch;
      fieldStarted = true;
    }
  }

  if (field !== '' || row.length > 0 || fieldStarted) {
    endRow();
  }
  return rows;
}

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) {
    return '';
  }
  const value = String(cell);
  return /[",\r\n]/.test(value) || value !== value.trim() ? `"${value.replace(/"/g, '""')}"` : value;
}

export function serializeCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}
