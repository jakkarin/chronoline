import type { Timeline } from '@/lib/types';
import { generateColumns, workingDaysBetween, DAY_LABELS } from '@/lib/date-utils';
import { PRIORITY_BAR_COLOR, resolveTaskBarColor } from '@/lib/task-colors';
import { format, parseISO } from 'date-fns';
import geistFontCss from '@fontsource-variable/geist/index.css?inline';

const CELL_W = 32; // px per day column
const MIN_DAY_COL_W = 24;
const MIN_INFO_COL_WIDTHS = {
  status: 76,
  priority: 56,
  indent: 18,
  task: 132,
  start: 64,
  end: 64,
  days: 34,
  owner: 96,
  deliverable: 96,
  percent: 84,
} as const;
const FIT_WIDTH_PAD = 28;
const SANS_FAMILY = "'Geist Variable', 'Noto Sans Thai', ui-sans-serif, system-ui, sans-serif";
const MONO_FAMILY = "'Ubuntu Mono', monospace";
const PRESENT_FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@100..900&family=Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
`;
const HEADER_FONT = `700 10px ${SANS_FAMILY}`;
const BADGE_FONT = `700 10px ${SANS_FAMILY}`;
const PROJECT_NAME_FONT = `700 12px ${SANS_FAMILY}`;
const TASK_NAME_FONT = `400 12px ${SANS_FAMILY}`;
const PROJECT_BODY_FONT = `400 12px ${SANS_FAMILY}`;
const TASK_BODY_FONT = `400 12px ${SANS_FAMILY}`;
const PROJECT_MONO_FONT = `400 12px ${MONO_FAMILY}`;
const TASK_MONO_FONT = `400 12px ${MONO_FAMILY}`;
const PERCENT_FONT = `400 9.5px ${MONO_FAMILY}`;
const DAY_LABEL_FONT = `600 10px ${SANS_FAMILY}`;
const DAY_DATE_FONT = `400 8px ${SANS_FAMILY}`;
const WEEK_HEADER_FONT = `600 10px ${SANS_FAMILY}`;
const HEADER_CELL_PAD_X = 16;
const BODY_CELL_PAD_X = 16;
const START_END_CELL_PAD_X = 28;
const TASK_CELL_PAD_X = 12;
const BADGE_PAD_X = 12;
const DAY_TEXT_PAD_X = 10;
const WEEK_TEXT_PAD_X = 10;
const PERCENT_LABEL_MIN_W = 18;
const PERCENT_CONTENT_MIN_W = 70;
const PERCENT_BAR_MIN_W = 49;
const PERCENT_GAP_W = 3;
const PRESENT_TASK_BAR_SLOT_H = 26;
const PRESENT_TASK_BAR_H = 18;
const PRESENT_BADGE_RADIUS = 3;
const PRESENT_TASK_BAR_FONT_SIZE = 10.5;
const PRESENT_TASK_BAR_FONT = `600 ${PRESENT_TASK_BAR_FONT_SIZE}px ${SANS_FAMILY}`;
const PRESENT_TASK_BAR_PAD_X = 8;
const PRESENT_TASK_BAR_LABEL_GAP = 6;
const PRESENT_HOLIDAY_COLUMN_BG = '#fffbeb';

interface PresentColumnWidths {
  status: number;
  priority: number;
  indent: number;
  task: number;
  start: number;
  end: number;
  days: number;
  owner: number;
  deliverable: number;
  percent: number;
  day: number;
  table: number;
}

let textMeasureContext: CanvasRenderingContext2D | null | undefined;

function getTextMeasureContext() {
  if (textMeasureContext !== undefined) return textMeasureContext;
  if (typeof document === 'undefined') {
    textMeasureContext = null;
    return textMeasureContext;
  }

  textMeasureContext = document.createElement('canvas').getContext('2d');
  return textMeasureContext;
}

function measureTextWidth(text: string, font: string, letterSpacing = 0) {
  const content = text.trim() || '—';
  const ctx = getTextMeasureContext();
  const letterSpacingWidth = Math.max(content.length - 1, 0) * letterSpacing;

  if (!ctx) return Math.ceil(content.length * 8 + letterSpacingWidth);

  ctx.font = font;
  return Math.ceil(ctx.measureText(content).width + letterSpacingWidth);
}

function measureHeaderCellWidth(text: string, minWidth: number, cellPaddingX = HEADER_CELL_PAD_X) {
  return Math.max(minWidth, measureTextWidth(text, HEADER_FONT, 0.5) + cellPaddingX);
}

function measureBodyCellWidth(text: string, font: string, minWidth: number, cellPaddingX = BODY_CELL_PAD_X) {
  return Math.max(minWidth, measureTextWidth(text || '—', font) + cellPaddingX);
}

function measureBadgeCellWidth(text: string, minWidth: number) {
  return Math.max(minWidth, measureTextWidth(text, BADGE_FONT, 0.3) + BADGE_PAD_X + BODY_CELL_PAD_X);
}

function measurePercentCellWidth(percent: number, minWidth: number) {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const labelWidth = Math.max(PERCENT_LABEL_MIN_W, measureTextWidth(`${clampedPercent}%`, PERCENT_FONT));
  const contentWidth = Math.max(PERCENT_CONTENT_MIN_W, PERCENT_BAR_MIN_W + PERCENT_GAP_W + labelWidth);
  return Math.max(minWidth, contentWidth + BODY_CELL_PAD_X);
}

function getPresentColumnWidths(
  timeline: Timeline,
  cols: ReturnType<typeof generateColumns>,
  weekGroups: { label: string }[]
): PresentColumnWidths {
  const indentWidth = MIN_INFO_COL_WIDTHS.indent;
  let statusWidth = measureHeaderCellWidth('STATUS', MIN_INFO_COL_WIDTHS.status);
  let priorityWidth = measureHeaderCellWidth('PRIORITY', MIN_INFO_COL_WIDTHS.priority);
  let projectTaskCombinedWidth = measureHeaderCellWidth(
    'PROJECT + TASK',
    indentWidth + MIN_INFO_COL_WIDTHS.task
  );
  let taskWidth: number = MIN_INFO_COL_WIDTHS.task;
  let startWidth = measureHeaderCellWidth('START', MIN_INFO_COL_WIDTHS.start, START_END_CELL_PAD_X);
  let endWidth = measureHeaderCellWidth('END', MIN_INFO_COL_WIDTHS.end, START_END_CELL_PAD_X);
  let daysWidth = measureHeaderCellWidth('DAYS', MIN_INFO_COL_WIDTHS.days);
  let ownerWidth = measureHeaderCellWidth('OWNER', MIN_INFO_COL_WIDTHS.owner);
  let deliverableWidth = measureHeaderCellWidth('DELIVERABLE', MIN_INFO_COL_WIDTHS.deliverable);
  let percentWidth = Math.max(
    measureHeaderCellWidth('%', MIN_INFO_COL_WIDTHS.percent),
    measurePercentCellWidth(100, MIN_INFO_COL_WIDTHS.percent)
  );
  let dayWidth = MIN_DAY_COL_W;

  for (const [index, col] of cols.entries()) {
    const dayLabel = DAY_LABELS[col.dayIndex];
    const dateLabel = format(col.date, index === 0 || col.dayIndex === 0 ? 'd/M' : 'd');
    dayWidth = Math.max(
      dayWidth,
      measureTextWidth(dayLabel, DAY_LABEL_FONT) + DAY_TEXT_PAD_X,
      measureTextWidth(dateLabel, DAY_DATE_FONT) + DAY_TEXT_PAD_X
    );
  }

  for (const weekGroup of weekGroups) {
    dayWidth = Math.max(
      dayWidth,
      Math.ceil((measureTextWidth(weekGroup.label, WEEK_HEADER_FONT) + WEEK_TEXT_PAD_X) / 5)
    );
  }

  for (const project of timeline.projects) {
    const projectStartDates = project.tasks.map((task) => task.startDate).filter(Boolean).sort();
    const projectEndDates = project.tasks.map((task) => task.endDate).filter(Boolean).sort();
    const projectStart = projectStartDates[0] ?? '';
    const projectEnd = projectEndDates[projectEndDates.length - 1] ?? '';
    const projectDays = workingDaysBetween(projectStart, projectEnd, timeline.holidays);

    statusWidth = Math.max(statusWidth, measureBadgeCellWidth(project.status, MIN_INFO_COL_WIDTHS.status));
    projectTaskCombinedWidth = Math.max(
      projectTaskCombinedWidth,
      measureBodyCellWidth(project.name, PROJECT_NAME_FONT, indentWidth + MIN_INFO_COL_WIDTHS.task)
    );
    startWidth = Math.max(
      startWidth,
      measureBodyCellWidth(
        projectStart ? format(parseISO(projectStart), 'dd/MM/yy') : '—',
        PROJECT_MONO_FONT,
        MIN_INFO_COL_WIDTHS.start,
        START_END_CELL_PAD_X
      )
    );
    endWidth = Math.max(
      endWidth,
      measureBodyCellWidth(
        projectEnd ? format(parseISO(projectEnd), 'dd/MM/yy') : '—',
        PROJECT_MONO_FONT,
        MIN_INFO_COL_WIDTHS.end,
        START_END_CELL_PAD_X
      )
    );
    daysWidth = Math.max(
      daysWidth,
      measureBodyCellWidth(String(projectDays || '—'), PROJECT_BODY_FONT, MIN_INFO_COL_WIDTHS.days)
    );
    ownerWidth = Math.max(
      ownerWidth,
      measureBodyCellWidth('—', PROJECT_BODY_FONT, MIN_INFO_COL_WIDTHS.owner)
    );
    deliverableWidth = Math.max(
      deliverableWidth,
      measureBodyCellWidth(project.deliverable || '—', PROJECT_BODY_FONT, MIN_INFO_COL_WIDTHS.deliverable)
    );

    for (const task of project.tasks) {
      const taskDays = workingDaysBetween(task.startDate, task.endDate, timeline.holidays);

      statusWidth = Math.max(statusWidth, measureBadgeCellWidth(task.status, MIN_INFO_COL_WIDTHS.status));

      if (task.priority) {
        priorityWidth = Math.max(
          priorityWidth,
          measureBadgeCellWidth(task.priority, MIN_INFO_COL_WIDTHS.priority)
        );
      }

      taskWidth = Math.max(
        taskWidth,
        measureBodyCellWidth(task.name || '—', TASK_NAME_FONT, MIN_INFO_COL_WIDTHS.task, TASK_CELL_PAD_X)
      );
      startWidth = Math.max(
        startWidth,
        measureBodyCellWidth(
          task.startDate ? format(parseISO(task.startDate), 'dd/MM/yy') : '—',
          TASK_MONO_FONT,
          MIN_INFO_COL_WIDTHS.start,
          START_END_CELL_PAD_X
        )
      );
      endWidth = Math.max(
        endWidth,
        measureBodyCellWidth(
          task.endDate ? format(parseISO(task.endDate), 'dd/MM/yy') : '—',
          TASK_MONO_FONT,
          MIN_INFO_COL_WIDTHS.end,
          START_END_CELL_PAD_X
        )
      );
      daysWidth = Math.max(
        daysWidth,
        measureBodyCellWidth(String(taskDays || '—'), TASK_BODY_FONT, MIN_INFO_COL_WIDTHS.days)
      );
      ownerWidth = Math.max(
        ownerWidth,
        measureBodyCellWidth(task.owner || '—', TASK_BODY_FONT, MIN_INFO_COL_WIDTHS.owner)
      );
      deliverableWidth = Math.max(
        deliverableWidth,
        measureBodyCellWidth(task.deliverable || '—', TASK_BODY_FONT, MIN_INFO_COL_WIDTHS.deliverable)
      );
      percentWidth = Math.max(percentWidth, measurePercentCellWidth(task.percentComplete, MIN_INFO_COL_WIDTHS.percent));
    }
  }

  taskWidth = Math.max(taskWidth, projectTaskCombinedWidth - indentWidth);

  statusWidth = Math.ceil(statusWidth);
  priorityWidth = Math.ceil(priorityWidth);
  taskWidth = Math.ceil(taskWidth);
  startWidth = Math.ceil(startWidth);
  endWidth = Math.ceil(endWidth);
  daysWidth = Math.ceil(daysWidth);
  ownerWidth = Math.ceil(ownerWidth);
  deliverableWidth = Math.ceil(deliverableWidth);
  percentWidth = Math.ceil(percentWidth);
  dayWidth = Math.ceil(dayWidth);

  return {
    status: statusWidth,
    priority: priorityWidth,
    indent: indentWidth,
    task: taskWidth,
    start: startWidth,
    end: endWidth,
    days: daysWidth,
    owner: ownerWidth,
    deliverable: deliverableWidth,
    percent: percentWidth,
    day: dayWidth,
    table:
      statusWidth +
      priorityWidth +
      indentWidth +
      taskWidth +
      startWidth +
      endWidth +
      daysWidth +
      ownerWidth +
      deliverableWidth +
      percentWidth +
      cols.length * dayWidth,
  };
}

const STATUS_COLOR: Record<string, string> = {
  'Not Started': '#78716c',
  'In Progress': '#2563eb',
  'Done':        '#059669',
  'Blocked':     '#dc2626',
  'On Hold':     '#ca8a04',
};

const TH = (style: string, content: string, extra = '') =>
  `<th style="${style}" ${extra}>${content}</th>`;

const TD = (style: string, content: string, extra = '') =>
  `<td style="${style}" ${extra}>${content}</td>`;

function badge(text: string, color: string) {
  return `<span style="display:inline-block;padding:1px 6px;border-radius:${PRESENT_BADGE_RADIUS}px;background:${color};color:#fff;font-size:10px;font-weight:700;letter-spacing:.3px;white-space:nowrap;line-height:1.4">${text}</span>`;
}

function pctCell(pct: number, color: string) {
  return `<div style="display:flex;align-items:center;gap:3px;min-width:70px">
    <div style="flex:1;height:5px;border-radius:3px;background:#e2e8f0;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div>
    </div>
    <span style="font-size:9.5px;color:#64748b;font-family:'Ubuntu Mono',monospace;min-width:18px;text-align:right">${pct}%</span>
  </div>`;
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ganttCells(
  startDate: string,
  endDate: string,
  cols: ReturnType<typeof generateColumns>,
  holidays: string[],
  color: string,
  isProject = false,
  label = '',
  dayColumnWidth = CELL_W
): string {
  const startIdx = cols.findIndex(c => c.dateStr === startDate);
  const endIdx   = cols.findIndex(c => c.dateStr === endDate);
  const trimmedLabel = label.trim();
  const barSpan = startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx
    ? endIdx - startIdx + 1
    : 0;
  const showTaskLabel = !isProject && trimmedLabel.length > 0 && barSpan > 0;
  const barWidthPx = Math.max(0, barSpan * dayColumnWidth - 4);
  const labelTextWidthPx = showTaskLabel
    ? Math.ceil(measureTextWidth(trimmedLabel, PRESENT_TASK_BAR_FONT))
    : 0;
  const labelFitsInsideBar = labelTextWidthPx + PRESENT_TASK_BAR_PAD_X * 2 <= barWidthPx;

  return cols.map((c, i) => {
    const inRange     = startIdx !== -1 && endIdx !== -1 && i >= startIdx && i <= endIdx;
    const isHolidayColumn = holidays.includes(c.dateStr);
    const isWeekStart = c.dayIndex === 0;
    const cellBg = isHolidayColumn
      ? PRESENT_HOLIDAY_COLUMN_BG
      : (isProject ? '#f0f4f8' : 'transparent');

    const borderLeft = `border-left:${isWeekStart ? '1px solid #94a3b8' : '1px solid #e2e8f0'};`;
    const borderBot  = 'border-bottom:1px solid #e2e8f0;';
    const labelBar = showTaskLabel && i === startIdx
      ? `<div style="position:relative;height:${PRESENT_TASK_BAR_SLOT_H}px;overflow:visible;z-index:2">
          <div style="position:absolute;left:2px;top:50%;transform:translateY(-50%);width:${barWidthPx}px;height:${PRESENT_TASK_BAR_H}px;border-radius:${PRESENT_BADGE_RADIUS}px;background:${color};display:flex;align-items:center;${labelFitsInsideBar ? `padding:0 ${PRESENT_TASK_BAR_PAD_X}px;overflow:hidden;text-overflow:ellipsis;` : ''}white-space:nowrap;color:#fff;font-size:${PRESENT_TASK_BAR_FONT_SIZE}px;font-weight:600;line-height:1;text-shadow:0 1px 1px rgba(15,23,42,0.35)">${labelFitsInsideBar ? escapeHtml(trimmedLabel) : ''}</div>
          ${labelFitsInsideBar ? '' : `<div style="position:absolute;left:${barWidthPx + PRESENT_TASK_BAR_LABEL_GAP}px;top:50%;transform:translateY(-50%);white-space:nowrap;color:#0f172a;font-size:${PRESENT_TASK_BAR_FONT_SIZE}px;font-weight:600;line-height:1">${escapeHtml(trimmedLabel)}</div>`}
        </div>`
      : '';
    const cellContent = isProject
      ? ''
      : labelBar;

    return `<td style="width:var(--day-col-width, ${CELL_W}px);min-width:var(--day-col-width, ${CELL_W}px);max-width:var(--day-col-width, ${CELL_W}px);padding:0;position:relative;overflow:visible;background:${cellBg};${!isProject && !isHolidayColumn && !showTaskLabel && inRange ? `background:${color}cc;` : ''}${borderLeft}${borderBot}">${cellContent}</td>`;
  }).join('');
}

const BORDER = 'border:1px solid #e2e8f0;';
const PROJ_BORDER = 'border:1px solid #cbd5e1;';

const CELL_STYLE = (bg: string, isProj: boolean, extra = '') =>
  `padding:4px 8px;background:${bg};${isProj ? PROJ_BORDER : BORDER}${extra}`;

const INFO_TH = `padding:5px 8px;background:#1e293b;color:#f1f5f9;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;text-align:left;border:1px solid #334155;white-space:nowrap;`;

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

  const columnWidths = getPresentColumnWidths(timeline, cols, weekGroups);

  // ── Build rows ─────────────────────────────────────────────────────────
  let rowsHtml = '';

  for (const project of timeline.projects) {
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
      ${TD(`${CELL_STYLE(rowBg, true)}font-size:12px;font-family:'Ubuntu Mono',monospace;white-space:nowrap;padding:4px 10px;`, pS ? format(parseISO(pS),'dd/MM/yy') : '—')}
      ${TD(`${CELL_STYLE(rowBg, true)}font-size:12px;font-family:'Ubuntu Mono',monospace;white-space:nowrap;padding:4px 10px;`, pE ? format(parseISO(pE),'dd/MM/yy') : '—')}
      ${TD(`${CELL_STYLE(rowBg, true)}text-align:center;font-size:12px;`, String(pDays || '—'))}
      ${TD(`${CELL_STYLE(rowBg, true)}font-size:12px;color:#475569;`, '—')}
      ${TD(`${CELL_STYLE(rowBg, true)}font-size:12px;color:#475569;`, project.deliverable || '—')}
      ${TD(`${CELL_STYLE(rowBg, true)}`, '—')}
      ${ganttCells(pS, pE, cols, timeline.holidays, projColor, true, '', columnWidths.day)}
    </tr>`;

    for (const task of project.tasks) {
      const days = workingDaysBetween(task.startDate, task.endDate, timeline.holidays);
      const taskBarColor = resolveTaskBarColor(task.color, task.priority);
      const statusColor  = STATUS_COLOR[task.status] ?? '#78716c';

      rowsHtml += `<tr>
        ${TD(CELL_STYLE('#fff', false), badge(task.status, statusColor))}
        ${TD(CELL_STYLE('#fff', false), task.priority ? badge(task.priority, PRIORITY_BAR_COLOR[task.priority] ?? '#888') : '')}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:12px;color:#cbd5e1;padding:0;text-align:center;overflow:hidden;`, '↳')}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:12px;color:#334155;padding-left:6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;`, task.name)}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:12px;font-family:'Ubuntu Mono',monospace;white-space:nowrap;padding:4px 10px;`, task.startDate ? format(parseISO(task.startDate),'dd/MM/yy') : '—')}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:12px;font-family:'Ubuntu Mono',monospace;white-space:nowrap;padding:4px 10px;`, task.endDate ? format(parseISO(task.endDate),'dd/MM/yy') : '—')}
        ${TD(`${CELL_STYLE('#fff', false)}text-align:center;font-size:12px;`, String(days || '—'))}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:12px;color:#64748b;`, task.owner || '—')}
        ${TD(`${CELL_STYLE('#fff', false)}font-size:12px;color:#64748b;`, task.deliverable || '—')}
        ${TD(`${CELL_STYLE('#fff', false)}`, pctCell(task.percentComplete, taskBarColor))}
        ${ganttCells(task.startDate, task.endDate, cols, timeline.holidays, taskBarColor, false, task.name, columnWidths.day)}
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
    return `<th style="width:var(--day-col-width, ${CELL_W}px);min-width:var(--day-col-width, ${CELL_W}px);padding:2px 4px;${bl}${bg}${col}font-size:10px;font-weight:600;text-align:center;border-bottom:2px solid #e2e8f0;white-space:nowrap">
      ${DAY_LABELS[c.dayIndex]}<br><span style="font-size:8px;font-weight:400">${format(c.date, i === 0 || c.dayIndex === 0 ? 'd/M' : 'd')}</span>
    </th>`;
  }).join('');

  const weekHeaderCells = weekGroups.map(w =>
    `<th colspan="5" style="padding:3px 6px;font-size:10px;font-weight:600;color:#64748b;text-align:center;background:#f8fafc;border-bottom:1px solid #e2e8f0;border-left:1px solid #94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${w.label}</th>`
  ).join('');

  const today = format(new Date(), 'dd/MM/yyyy HH:mm');
  const CONTENT_PAD = 24; // horizontal padding each side

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
${PRESENT_FONT_LINKS}
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<style>
  ${geistFontCss}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --col-status-width: ${columnWidths.status}px;
    --col-priority-width: ${columnWidths.priority}px;
    --col-indent-width: ${columnWidths.indent}px;
    --col-task-width: ${columnWidths.task}px;
    --col-start-width: ${columnWidths.start}px;
    --col-end-width: ${columnWidths.end}px;
    --col-days-width: ${columnWidths.days}px;
    --col-owner-width: ${columnWidths.owner}px;
    --col-deliverable-width: ${columnWidths.deliverable}px;
    --col-percent-width: ${columnWidths.percent}px;
    --day-col-width: ${columnWidths.day}px;
    --table-fit-width: ${columnWidths.table + CONTENT_PAD * 2 + FIT_WIDTH_PAD}px;
  }
  html, body { width: 100%; min-height: 100%; }
  body { font-family: ${SANS_FAMILY}; background: #fff; color: #0f172a; overflow: auto; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  #content { width: var(--table-fit-width); min-height: 100vh; padding: 14px ${CONTENT_PAD}px; background: #fff; }
</style>
<script>
window.__capture = function() {
  var el = document.getElementById('content');
  if (!el) {
    window.parent.postMessage({ type: 'CAPTURE_ERROR', message: 'Content not found' }, '*');
    return;
  }

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
</script>
</head><body>
<div id="content">

<!-- Header -->
<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;width:100%;">
  <span style="font-size:14px;font-weight:800;color:#0f172a;letter-spacing:-.3px">${title}</span>
  ${timeline.customer ? `<span style="font-size:9px;background:#f1f5f9;border-radius:3px;padding:1px 6px;color:#475569;font-weight:600">${timeline.customer}</span>` : ''}
  ${timeline.note ? `<span style="font-size:9px;color:#94a3b8">${timeline.note}</span>` : ''}
  <span style="margin-left:auto;font-size:8px;color:#cbd5e1">Exported ${today}</span>
</div>

<!-- Main table -->
<table>
  <colgroup>
    <col style="width:var(--col-status-width)">
    <col style="width:var(--col-priority-width)">
    <col style="width:var(--col-indent-width)">
    <col style="width:var(--col-task-width)">
    <col style="width:var(--col-start-width)">
    <col style="width:var(--col-end-width)">
    <col style="width:var(--col-days-width)">
    <col style="width:var(--col-owner-width)">
    <col style="width:var(--col-deliverable-width)">
    <col style="width:var(--col-percent-width)">
    ${cols.map(() => `<col style="width:var(--day-col-width, ${CELL_W}px)">`).join('')}
  </colgroup>
  <thead>
    <tr>
      ${TH(INFO_TH, 'STATUS', 'rowspan="2"')}
      ${TH(INFO_TH, 'PRIORITY', 'rowspan="2"')}
      ${TH(INFO_TH, 'PROJECT + TASK', 'rowspan="2" colspan="2"')}
      ${TH(`${INFO_TH}padding:5px 14px;`, 'START', 'rowspan="2"')}
      ${TH(`${INFO_TH}padding:5px 14px;`, 'END', 'rowspan="2"')}
      ${TH(`${INFO_TH}text-align:center;`, 'DAYS', 'rowspan="2"')}
      ${TH(INFO_TH, 'OWNER', 'rowspan="2"')}
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
