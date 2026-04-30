import type { Timeline } from '@/lib/types';
import { generateColumns, workingDaysBetween, DAY_LABELS } from '@/lib/date-utils';
import { format, parseISO } from 'date-fns';

const CELL_W = 32; // px per day column

const STATUS_COLOR: Record<string, string> = {
  'Not Started': '#78716c',
  'In Progress': '#2563eb',
  'Done':        '#059669',
  'Blocked':     '#dc2626',
  'On Hold':     '#ca8a04',
};

const PRIORITY_BAR_COLOR: Record<string, string> = {
  HIGHEST: '#dc2626',
  HIGH:    '#ea580c',
  MED:     '#ca8a04',
  LOW:     '#0891b2',
  LOWEST:  '#78716c',
  NONE:    '#78716c',
};

const TH = (style: string, content: string, extra = '') =>
  `<th style="${style}" ${extra}>${content}</th>`;

const TD = (style: string, content: string, extra = '') =>
  `<td style="${style}" ${extra}>${content}</td>`;

function badge(text: string, color: string) {
  return `<span style="display:inline-block;padding:1px 5px;border-radius:3px;background:${color};color:#fff;font-size:10px;font-weight:700;letter-spacing:.3px;white-space:nowrap;line-height:1.4">${text}</span>`;
}

function pctCell(pct: number, color: string) {
  return `<div style="display:flex;align-items:center;gap:3px;min-width:70px">
    <div style="flex:1;height:5px;border-radius:3px;background:#e2e8f0;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div>
    </div>
    <span style="font-size:9.5px;color:#64748b;font-family:'Ubuntu Mono',monospace;min-width:18px;text-align:right">${pct}%</span>
  </div>`;
}

function ganttCells(startDate: string, endDate: string, cols: ReturnType<typeof generateColumns>, color: string, isProject = false): string {
  const startIdx = cols.findIndex(c => c.dateStr === startDate);
  const endIdx   = cols.findIndex(c => c.dateStr === endDate);

  return cols.map((c, i) => {
    const inRange     = startIdx !== -1 && endIdx !== -1 && i >= startIdx && i <= endIdx;
    const isWeekStart = c.dayIndex === 0;
    const cellBg = isProject ? '#f0f4f8' : (inRange ? color + 'cc' : 'transparent');

    const borderLeft = `border-left:${isWeekStart ? '1px solid #94a3b8' : '1px solid #e2e8f0'};`;
    const borderBot  = 'border-bottom:1px solid #e2e8f0;';

    return `<td style="width:${CELL_W}px;min-width:${CELL_W}px;max-width:${CELL_W}px;padding:0;background:${cellBg};${borderLeft}${borderBot}"></td>`;
  }).join('');
}

const BORDER = 'border:1px solid #e2e8f0;';
const PROJ_BORDER = 'border:1px solid #cbd5e1;';

const CELL_STYLE = (bg: string, isProj: boolean, extra = '') =>
  `padding:4px 6px;background:${bg};${isProj ? PROJ_BORDER : BORDER}${extra}`;

const INFO_TH = `padding:5px 6px;background:#1e293b;color:#f1f5f9;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;text-align:left;border:1px solid #334155;white-space:nowrap;`;

export function generatePresentHTML(title: string, timeline: Timeline): string {
  const cols = generateColumns(timeline.startDate, timeline.weeks);

  // ── Week groups for header ─────────────────────────────────────────────
  const weekGroups: { label: string }[] = [];
  let curW = -1;
  for (const col of cols) {
    if (col.weekIndex !== curW) {
      curW = col.weekIndex;
      const mon = col.date;
      const fri = new Date(mon); fri.setDate(fri.getDate() + 4);
      weekGroups.push({ label: `Wk ${col.weekIndex + 1}  ${format(mon,'d MMM')}–${format(fri,'d MMM yyyy')}` });
    }
  }

  // ── Build rows ─────────────────────────────────────────────────────────
  let rowsHtml = '';
  let colorIdx = 0;

  for (const project of timeline.projects) {
    colorIdx++;
    const projColor = STATUS_COLOR[project.status] ?? '#78716c';
    const allS  = project.tasks.map(t => t.startDate).filter(Boolean).sort();
    const allE  = project.tasks.map(t => t.endDate).filter(Boolean).sort();
    const pS    = allS[0] ?? '';
    const pE    = allE[allE.length - 1] ?? '';
    const pDays = workingDaysBetween(pS, pE, timeline.holidays);
    const rowBg = '#f0f4f8';

    rowsHtml += `<tr>
      ${TD(CELL_STYLE(rowBg, true), badge(project.status, projColor))}
      ${TD(CELL_STYLE(rowBg, true), '')}
      ${TD(`${CELL_STYLE(rowBg, true)}font-size:12px;font-weight:700;color:#0f172a;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;`, project.name, 'colspan="2"')}
      ${TD(`${CELL_STYLE(rowBg, true)}font-size:12px;font-family:'Ubuntu Mono',monospace;white-space:nowrap;`, pS ? format(parseISO(pS),'dd/MM/yy') : '—')}
      ${TD(`${CELL_STYLE(rowBg, true)}font-size:12px;font-family:'Ubuntu Mono',monospace;white-space:nowrap;`, pE ? format(parseISO(pE),'dd/MM/yy') : '—')}
      ${TD(`${CELL_STYLE(rowBg, true)}text-align:center;font-size:12px;`, String(pDays || '—'))}
      ${TD(`${CELL_STYLE(rowBg, true)}font-size:12px;color:#475569;`, project.deliverable || '—')}
      ${TD(`${CELL_STYLE(rowBg, true)}`, '—')}
      ${ganttCells(pS, pE, cols, projColor, true)}
    </tr>`;

    for (const task of project.tasks) {
      const days = workingDaysBetween(task.startDate, task.endDate, timeline.holidays);
      const taskBarColor = PRIORITY_BAR_COLOR[task.priority ?? 'NONE'] ?? '#78716c';
      const statusColor  = STATUS_COLOR[task.status] ?? '#78716c';

      rowsHtml += `<tr>
        ${TD(CELL_STYLE('#fff', false), badge(task.status, statusColor))}
        ${TD(CELL_STYLE('#fff', false), task.priority ? badge(task.priority, PRIORITY_BAR_COLOR[task.priority] ?? '#888') : '')}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:11px;color:#cbd5e1;padding:0;text-align:center;overflow:hidden;`, '↳')}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:11px;color:#334155;padding-left:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;`, task.name)}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:10.5px;font-family:'Ubuntu Mono',monospace;white-space:nowrap;`, task.startDate ? format(parseISO(task.startDate),'dd/MM/yy') : '—')}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:10.5px;font-family:'Ubuntu Mono',monospace;white-space:nowrap;`, task.endDate ? format(parseISO(task.endDate),'dd/MM/yy') : '—')}
        ${TD(`${CELL_STYLE('#fff', false)}text-align:center;font-size:10.5px;`, String(days || '—'))}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:10.5px;color:#64748b;`, task.deliverable || '—')}
        ${TD(`${CELL_STYLE('#fff', false)}`, pctCell(task.percentComplete, taskBarColor))}
        ${ganttCells(task.startDate, task.endDate, cols, taskBarColor)}
      </tr>`;
    }
  }

  // ── Day header row ─────────────────────────────────────────────────────
  const holidays = timeline.holidays;
  const dayHeaderCells = cols.map((c, i) => {
    const isWeekStart = c.dayIndex === 0;
    const isHol       = holidays.includes(c.dateStr);
    const bl  = isWeekStart ? 'border-left:1px solid #94a3b8;' : '';
    const bg  = isHol ? 'background:#fef3c7;' : 'background:#f8fafc;';
    const col = isHol ? 'color:#92400e;' : 'color:#94a3b8;';
    return `<th style="width:${CELL_W}px;min-width:${CELL_W}px;padding:2px 0;${bl}${bg}${col}font-size:10px;font-weight:600;text-align:center;border-bottom:2px solid #e2e8f0;white-space:nowrap">
      ${DAY_LABELS[c.dayIndex]}<br><span style="font-size:8px;font-weight:400">${format(c.date, i === 0 || c.dayIndex === 0 ? 'd/M' : 'd')}</span>
    </th>`;
  }).join('');

  const weekHeaderCells = weekGroups.map(w =>
    `<th colspan="5" style="padding:3px 4px;font-size:10px;font-weight:600;color:#64748b;text-align:center;background:#f8fafc;border-bottom:1px solid #e2e8f0;border-left:1px solid #94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${w.label}</th>`
  ).join('');

  const today = format(new Date(), 'dd/MM/yyyy HH:mm');

  // Exact table content width (matches colgroup widths)
  const TABLE_W = 80 + 58 + 20 + 150 + 68 + 68 + 34 + 110 + 90 + cols.length * CELL_W;
  const CONTENT_PAD = 20; // horizontal padding each side
  const FULL_W = TABLE_W + CONTENT_PAD * 2;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Geist Variable', ui-sans-serif, system-ui, sans-serif; background: #fff; color: #0f172a; }
  table { border-collapse: collapse; }
  #content { padding:14px ${CONTENT_PAD}px;background:#fff;min-width:${FULL_W}px;width:${FULL_W}px; }
</style>
<script>
window.__capture = function() {
  var el = document.getElementById('content');
  var w = el.scrollWidth; var h = el.scrollHeight;
  return html2canvas(el, {
    scale: 2, useCORS: true, backgroundColor: '#ffffff',
    scrollX: 0, scrollY: 0,
    windowWidth: w, windowHeight: h, width: w, height: h, logging: false
  }).then(function(canvas) {
    var dataUrl = canvas.toDataURL('image/png');
    window.parent.postMessage({ type: 'CAPTURE_DONE', dataUrl: dataUrl }, '*');
  }).catch(function(err) {
    window.parent.postMessage({ type: 'CAPTURE_ERROR', message: err.message }, '*');
  });
};
<\/script>
</head><body>
<div id="content">

<!-- Header -->
<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;min-width:${TABLE_W}px;">
  <span style="font-size:14px;font-weight:800;color:#0f172a;letter-spacing:-.3px">${title}</span>
  ${timeline.customer ? `<span style="font-size:9px;background:#f1f5f9;border-radius:3px;padding:1px 6px;color:#475569;font-weight:600">${timeline.customer}</span>` : ''}
  ${timeline.note ? `<span style="font-size:9px;color:#94a3b8">${timeline.note}</span>` : ''}
  <span style="margin-left:auto;font-size:8px;color:#cbd5e1">Exported ${today}</span>
</div>

<!-- Main table -->
<table style="width:100%;table-layout:fixed;border-collapse:collapse">
  <colgroup>
    <col style="width:80px">
    <col style="width:58px">
    <col style="width:20px">
    <col style="width:150px">
    <col style="width:68px">
    <col style="width:68px">
    <col style="width:34px">
    <col style="width:110px">
    <col style="width:90px">
    ${cols.map(() => `<col style="width:${CELL_W}px">`).join('')}
  </colgroup>
  <thead>
    <tr>
      ${TH(INFO_TH, 'STATUS', 'rowspan="2"')}
      ${TH(INFO_TH, 'PRIORITY', 'rowspan="2"')}
      ${TH(INFO_TH, 'PROJECT + TASK', 'rowspan="2" colspan="2"')}
      ${TH(INFO_TH, 'START', 'rowspan="2"')}
      ${TH(INFO_TH, 'END', 'rowspan="2"')}
      ${TH(`${INFO_TH}text-align:center;`, 'DAYS', 'rowspan="2"')}
      ${TH(INFO_TH, 'DELIVERABLE', 'rowspan="2"')}
      ${TH(`${INFO_TH}text-align:center;`, '%', 'rowspan="2"')}
      ${weekHeaderCells}
    </tr>
    <tr>${dayHeaderCells}</tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

</div>
</body></html>`;

  return html;
}

export function exportPDF(_tableWrapEl: HTMLElement, title: string, timeline: Timeline) {
  const html = generatePresentHTML(title, timeline);
  const win = window.open('', '_blank');
  if (!win) throw new Error('Pop-up blocked');
  win.document.write(html);
  win.document.close();
}
