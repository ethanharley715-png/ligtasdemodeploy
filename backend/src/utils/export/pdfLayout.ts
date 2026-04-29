import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 48;
const PAGE_MARGIN_TOP = 56;
const PAGE_MARGIN_BOTTOM = 48;
const DEFAULT_LINE_HEIGHT = 16;

const COLORS = {
  text: rgb(0.1, 0.14, 0.2),
  muted: rgb(0.39, 0.45, 0.55),
  border: rgb(0.83, 0.86, 0.9),
  headerFill: rgb(0.93, 0.96, 0.99),
  sectionFill: rgb(0.97, 0.98, 0.99),
  statFill: rgb(0.95, 0.97, 1),
  accent: rgb(0.16, 0.32, 0.59),
  success: rgb(0.11, 0.48, 0.26),
  warning: rgb(0.64, 0.39, 0.05),
} as const;

type TextOptions = {
  size?: number;
  font?: PDFFont;
  color?: ReturnType<typeof rgb>;
  indent?: number;
  lineHeight?: number;
};

type LabeledValue = {
  label: string;
  value: string;
  wrap?: boolean;
};

type Metric = {
  label: string;
  value: string;
};

type LabeledValueRow = {
  labelLines: string[];
  valueLines: string[];
};

function measureWrappedLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      if (!word.includes("-")) {
        return [word];
      }

      const pieces = word.split("-");
      return pieces.flatMap((piece, index) => (index < pieces.length - 1 ? [`${piece}-`] : [piece]));
    });
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function buildLabeledValueRows(
  items: LabeledValue[],
  labelFont: PDFFont,
  valueFont: PDFFont,
  size: number,
  labelWidth: number,
  valueWidth: number,
): LabeledValueRow[] {
  return items.map((item) => ({
    labelLines: measureWrappedLines(`${item.label}:`, labelFont, size, labelWidth),
    valueLines: item.wrap
      ? measureWrappedLines(item.value, valueFont, size, valueWidth)
      : [item.value],
  }));
}

export async function createPdfLayout() {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - PAGE_MARGIN_TOP;

  function availableHeight(): number {
    return y - PAGE_MARGIN_BOTTOM;
  }

  function startPage(): void {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - PAGE_MARGIN_TOP;
  }

  function ensureSpace(requiredHeight = 48): void {
    if (availableHeight() >= requiredHeight) {
      return;
    }

    startPage();
  }

  function drawText(text: string, options: TextOptions = {}): void {
    const size = options.size ?? 11;
    const font = options.font ?? regular;
    const color = options.color ?? COLORS.text;
    const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;
    const x = PAGE_MARGIN_X + (options.indent ?? 0);

    ensureSpace(lineHeight + 4);
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color,
    });
    y -= lineHeight;
  }

  function drawWrappedText(text: string, options: TextOptions = {}): void {
    const size = options.size ?? 11;
    const font = options.font ?? regular;
    const color = options.color ?? COLORS.text;
    const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;
    const indent = options.indent ?? 0;
    const maxWidth = PAGE_WIDTH - PAGE_MARGIN_X * 2 - indent;
    const lines = measureWrappedLines(text, font, size, maxWidth);

    ensureSpace(lines.length * lineHeight + 8);
    for (const line of lines) {
      page.drawText(line, {
        x: PAGE_MARGIN_X + indent,
        y,
        size,
        font,
        color,
      });
      y -= lineHeight;
    }
  }

  function drawDivider(spacingBefore = 8, spacingAfter = 12): void {
    ensureSpace(spacingBefore + spacingAfter + 8);
    y -= spacingBefore;
    page.drawLine({
      start: { x: PAGE_MARGIN_X, y },
      end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y },
      thickness: 1,
      color: COLORS.border,
    });
    y -= spacingAfter;
  }

  function drawHeader(title: string, subtitle: string): void {
    const height = 78;
    ensureSpace(height + 12);

    const topY = y;
    page.drawRectangle({
      x: PAGE_MARGIN_X,
      y: topY - height + 10,
      width: PAGE_WIDTH - PAGE_MARGIN_X * 2,
      height,
      borderWidth: 1,
      borderColor: COLORS.border,
      color: COLORS.headerFill,
    });

    page.drawText(title, {
      x: PAGE_MARGIN_X + 16,
      y: topY - 18,
      size: 20,
      font: bold,
      color: COLORS.text,
    });

    page.drawText(subtitle, {
      x: PAGE_MARGIN_X + 16,
      y: topY - 40,
      size: 10,
      font: regular,
      color: COLORS.muted,
    });

    y -= height + 8;
  }

  function drawSectionHeading(title: string): void {
    ensureSpace(32);
    page.drawText(title, {
      x: PAGE_MARGIN_X,
      y,
      size: 14,
      font: bold,
      color: COLORS.accent,
    });
    y -= 12;
    page.drawLine({
      start: { x: PAGE_MARGIN_X, y },
      end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y },
      thickness: 1,
      color: COLORS.border,
    });
    y -= 14;
  }

  function drawKeyValueList(items: LabeledValue[], options?: { box?: boolean }): void {
    const contentWidth = PAGE_WIDTH - PAGE_MARGIN_X * 2 - (options?.box ? 28 : 0);
    const labelWidth = 132;
    const valueWidth = contentWidth - labelWidth;
    const rows = buildLabeledValueRows(items, bold, regular, 10.5, labelWidth - 10, valueWidth);

    const rowHeight = rows.reduce(
      (total, row) => total + Math.max(row.labelLines.length, row.valueLines.length, 1) * 14 + 4,
      0,
    );
    const boxHeight = rowHeight + (options?.box ? 16 : 0);

    ensureSpace(boxHeight + 4);

    if (options?.box) {
      page.drawRectangle({
        x: PAGE_MARGIN_X,
        y: y - boxHeight + 8,
        width: PAGE_WIDTH - PAGE_MARGIN_X * 2,
        height: boxHeight,
        borderWidth: 1,
        borderColor: COLORS.border,
        color: COLORS.sectionFill,
      });
    }

    let rowY = y - (options?.box ? 12 : 0);
    const startX = PAGE_MARGIN_X + (options?.box ? 14 : 0);

    for (const row of rows) {
      for (let index = 0; index < row.labelLines.length; index += 1) {
        page.drawText(row.labelLines[index], {
          x: startX,
          y: rowY - index * 14,
          size: 10.5,
          font: bold,
          color: COLORS.text,
        });
      }

      for (let index = 0; index < row.valueLines.length; index += 1) {
        page.drawText(row.valueLines[index], {
          x: startX + labelWidth,
          y: rowY - index * 14,
          size: 10.5,
          font: regular,
          color: COLORS.text,
        });
      }

      rowY -= Math.max(row.labelLines.length, row.valueLines.length, 1) * 14 + 4;
    }

    y -= boxHeight + 6;
  }

  function drawMetricCards(metrics: Metric[]): void {
    if (metrics.length === 0) {
      return;
    }

    const cardGap = 10;
    const cardWidth = (PAGE_WIDTH - PAGE_MARGIN_X * 2 - cardGap) / 2;
    const cardHeight = 54;

    for (let index = 0; index < metrics.length; index += 2) {
      ensureSpace(cardHeight + 8);
      const rowY = y;

      for (let column = 0; column < 2; column += 1) {
        const metric = metrics[index + column];
        if (!metric) {
          continue;
        }

        const x = PAGE_MARGIN_X + column * (cardWidth + cardGap);
        page.drawRectangle({
          x,
          y: rowY - cardHeight + 6,
          width: cardWidth,
          height: cardHeight,
          borderWidth: 1,
          borderColor: COLORS.border,
          color: COLORS.statFill,
        });
        page.drawText(metric.label, {
          x: x + 12,
          y: rowY - 16,
          size: 9.5,
          font: regular,
          color: COLORS.muted,
        });
        page.drawText(metric.value, {
          x: x + 12,
          y: rowY - 36,
          size: 16,
          font: bold,
          color: COLORS.text,
        });
      }

      y -= cardHeight + 8;
    }
  }

  function drawCard(title: string, items: LabeledValue[], options?: { accent?: "default" | "success" | "warning" }) {
    const accent = options?.accent === "success"
      ? COLORS.success
      : options?.accent === "warning"
        ? COLORS.warning
        : COLORS.accent;

    const contentWidth = PAGE_WIDTH - PAGE_MARGIN_X * 2 - 34;
    const labelWidth = 132;
    const valueWidth = contentWidth - labelWidth;
    const rows = buildLabeledValueRows(items, bold, regular, 10.5, labelWidth - 10, valueWidth);
    const bodyHeight = rows.reduce(
      (total, row) => total + Math.max(row.labelLines.length, row.valueLines.length, 1) * 14 + 4,
      0,
    );
    const totalHeight = bodyHeight + 34;

    ensureSpace(totalHeight + 8);

    page.drawRectangle({
      x: PAGE_MARGIN_X,
      y: y - totalHeight + 8,
      width: PAGE_WIDTH - PAGE_MARGIN_X * 2,
      height: totalHeight,
      borderWidth: 1,
      borderColor: COLORS.border,
      color: COLORS.sectionFill,
    });
    page.drawRectangle({
      x: PAGE_MARGIN_X,
      y: y - totalHeight + 8,
      width: 5,
      height: totalHeight,
      color: accent,
    });
    page.drawText(title, {
      x: PAGE_MARGIN_X + 16,
      y: y - 16,
      size: 12,
      font: bold,
      color: COLORS.text,
    });

    let rowY = y - 34;
    const startX = PAGE_MARGIN_X + 16;
    for (const row of rows) {
      for (let index = 0; index < row.labelLines.length; index += 1) {
        page.drawText(row.labelLines[index], {
          x: startX,
          y: rowY - index * 14,
          size: 10.5,
          font: bold,
          color: COLORS.text,
        });
      }
      for (let index = 0; index < row.valueLines.length; index += 1) {
        page.drawText(row.valueLines[index], {
          x: startX + labelWidth,
          y: rowY - index * 14,
          size: 10.5,
          font: regular,
          color: COLORS.text,
        });
      }
      rowY -= Math.max(row.labelLines.length, row.valueLines.length, 1) * 14 + 4;
    }

    y -= totalHeight + 8;
  }

  async function save(): Promise<Buffer> {
    const pages = pdf.getPages();
    for (let index = 0; index < pages.length; index += 1) {
      const currentPage = pages[index];
      currentPage.drawLine({
        start: { x: PAGE_MARGIN_X, y: 28 },
        end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y: 28 },
        thickness: 1,
        color: COLORS.border,
      });
      currentPage.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: PAGE_WIDTH - PAGE_MARGIN_X - 68,
        y: 14,
        size: 9,
        font: regular,
        color: COLORS.muted,
      });
    }

    return Buffer.from(await pdf.save());
  }

  return {
    regular,
    bold,
    colors: COLORS,
    drawHeader,
    drawSectionHeading,
    drawKeyValueList,
    drawMetricCards,
    drawCard,
    drawText,
    drawWrappedText,
    drawDivider,
    save,
  };
}
