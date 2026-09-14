import { createAccidentAlert, listAccidentAlerts } from "../services/accidentService.js";

export async function postAccidentAlert(req, res, next) {
  try {
    const result = await createAccidentAlert(req.body, req.app.get("io"));
    res.status(201).json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAccidentAlerts(req, res, next) {
  try {
    const data = await listAccidentAlerts({
      deviceId: req.query.deviceId,
      limit: req.query.limit,
    });
    res.json({ ok: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
}
