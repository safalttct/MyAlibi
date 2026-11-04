import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LeaveRecord, durationToDays } from '../models/leave.models';
import { fromIsoDate } from './dates';

export interface RecordsPdfOptions {
  /** Document title under the brand line. */
  readonly title?: string;
  /** Extra subtitle lines (filters, leave year, employee name, …). */
  readonly subtitle?: readonly string[];
  readonly filename?: string;
}

/**
 * Builds and downloads a printable PDF of leave / WFH records.
 * Shared by Records and Settings → Data export.
 */
export function downloadRecordsPdf(
  records: readonly LeaveRecord[],
  options: RecordsPdfOptions = {},
): void {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const stamp = format(new Date(), 'yyyy-MM-dd');
  const filename = options.filename ?? `myalibi-records-${stamp}.pdf`;

  const completeDays = sorted
    .filter((r) => r.status === 'complete')
    .reduce((sum, r) => sum + durationToDays(r.duration), 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MyAlibi', marginX, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(options.title ?? 'Leave & WFH records', marginX, y);
  y += 14;

  doc.setFontSize(9);
  doc.setTextColor(100);
  for (const line of options.subtitle ?? []) {
    doc.text(line, marginX, y);
    y += 12;
  }
  doc.text(
    `Exported ${format(new Date(), 'd MMM yyyy, HH:mm')} · ${sorted.length} record(s) · ${completeDays} complete day(s)`,
    marginX,
    y,
  );
  doc.setTextColor(0);
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [['Entry', 'Date', 'Category', 'Duration', 'Days', 'Notes']],
    body: sorted.map((r) => {
      const d = fromIsoDate(r.date);
      return [
        r.title,
        format(d, 'd MMM yyyy'),
        r.category,
        r.duration ?? 'Needs review',
        r.status === 'complete' ? String(durationToDays(r.duration)) : '—',
        r.notes?.trim() ? r.notes : '—',
      ];
    }),
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: [53, 35, 75],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 246, 252] },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 72 },
      2: { cellWidth: 100 },
      3: { cellWidth: 70 },
      4: { cellWidth: 36, halign: 'right' },
      5: { cellWidth: 'auto' },
    },
    margin: { left: marginX, right: marginX },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Page ${data.pageNumber}`,
        doc.internal.pageSize.getWidth() - marginX,
        doc.internal.pageSize.getHeight() - 16,
        { align: 'right' },
      );
      doc.setTextColor(0);
    },
  });

  doc.save(filename);
}
