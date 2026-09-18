import { listReportAccidents, summarizeReportAccidents } from "../services/accidentService.js";

function filters(query) {
  return {
    deviceId: query.deviceId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    status: query.status,
    severity: query.severity,
    gpsStatus: query.gpsStatus,
    limit: query.limit,
  };
}

export async function getReportAccidents(req, res, next) {
  try {
    const data = await listReportAccidents(filters(req.query));
    res.json({ ok: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
}

export async function getReportSummary(req, res, next) {
  try {
    res.json({ ok: true, data: await summarizeReportAccidents(filters(req.query)) });
  } catch (error) {
    next(error);
  }
}