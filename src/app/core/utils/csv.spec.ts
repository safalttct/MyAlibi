import { parseCsv, serializeCsv } from './csv';

describe('csv', () => {
  it('parses quoted fields with commas, escaped quotes and CRLF', () => {
    const rows = parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\r\n');
    expect(rows).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps empty trailing fields and skips blank lines', () => {
    expect(parseCsv('a,b,\n\nc,,\n')).toEqual([
      ['a', 'b', ''],
      ['c', '', ''],
    ]);
  });

  it('strips a BOM and supports embedded newlines', () => {
    expect(parseCsv('\uFEFFx,"line1\nline2"')).toEqual([['x', 'line1\nline2']]);
  });

  it('round-trips through serializeCsv', () => {
    const data = [
      ['Entry', 'Date'],
      ['Hello, "World"', 'April 1, 2026'],
      [' padded ', ''],
    ];
    expect(parseCsv(serializeCsv(data))).toEqual(data);
  });
});
