export function normalizeVibrationInput(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return undefined;
}

export async function readSw420State(readDigitalInput) {
  if (typeof readDigitalInput !== "function") return undefined;
  return Boolean(await readDigitalInput());
}