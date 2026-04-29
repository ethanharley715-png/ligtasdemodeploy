import { buildWeeklyDigestCsv } from "../utils/export/weeklyDigestCsv";
import { buildWeeklyDigestPdf } from "../utils/export/weeklyDigestPdf";
import {
  buildWeeklyDigestData,
  buildWeeklyDigestFilename,
  parseWeeklyDigestParams,
  type WeeklyDigestRequest,
} from "./weeklyDigestService";

export async function exportWeeklyDigestAsCsv(
  request: WeeklyDigestRequest,
  now: Date = new Date(),
): Promise<{ fileName: string; contentType: string; buffer: Buffer }> {
  const params = parseWeeklyDigestParams(request);
  const data = await buildWeeklyDigestData(params, undefined, now);

  return {
    fileName: buildWeeklyDigestFilename(params, "csv", now),
    contentType: "text/csv; charset=utf-8",
    buffer: Buffer.from(buildWeeklyDigestCsv(data), "utf-8"),
  };
}

export async function exportWeeklyDigestAsPdf(
  request: WeeklyDigestRequest,
  now: Date = new Date(),
): Promise<{ fileName: string; contentType: string; buffer: Buffer }> {
  const params = parseWeeklyDigestParams(request);
  const data = await buildWeeklyDigestData(params, undefined, now);

  return {
    fileName: buildWeeklyDigestFilename(params, "pdf", now),
    contentType: "application/pdf",
    buffer: await buildWeeklyDigestPdf(data),
  };
}
