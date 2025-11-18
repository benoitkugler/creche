import Excel from "exceljs";
import {
  HeureMax,
  HeureMin,
  type DayIndex,
  type Horaire,
  type Range,
} from "./types";

export type int = number;

export function formatHoraire(h: Horaire) {
  return `${h.heure.toString().padStart(2, "0")}:${h.minute
    .toString()
    .padStart(2, "0")}`;
}

/** returns true if h1 <= h2 */
export function isBefore(h1: Horaire, h2: Horaire) {
  return (
    h1.heure < h2.heure || (h1.heure == h2.heure && h1.minute <= h2.minute)
  );
}

export function rangeIsEmpty(r: Range) {
  return isBefore(r.end, r.start);
}

/** returns true if other is (fully) included in this range */
export function rangeIncludes(r: Range, other: Range): boolean {
  if (rangeIsEmpty(other)) return true;
  return isBefore(r.start, other.start) && isBefore(other.end, r.end);
}

export function emptyRange(): Range {
  return { start: { heure: 0, minute: 0 }, end: { heure: 0, minute: 0 } };
}

// accept dd:dd dd:dd
export function parseRange(cell: string): Range | error {
  const reHoraire = /(\d+):(\d+)\s+(\d+):(\d+)/;
  const match = reHoraire.exec(cell);
  if (match === null) {
    return newError(`Format de plage d'horaires invalide : ${cell}`);
  }
  const start = parseHoraire(match[1], match[2]);
  if (isError(start)) return start;
  const end = parseHoraire(match[3], match[4]);
  if (isError(end)) return end;

  return { start, end };
}

export function formatRange(r: Range) {
  return `${formatHoraire(r.start)} -> ${formatHoraire(r.end)}`;
}

export function parseHoraire(hour: string, minute: string): Horaire | error {
  const h = isHeure(Number(hour));
  const m = isMinute(Number(minute));
  if (h == null || m == null) {
    return newError(`Valeurs d'horaire non supportées ${hour}:${minute}`);
  }
  return { heure: h, minute: m };
}

export type Minute = 0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55;
export type Heure =
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21;

export function isHeure(v: int): Heure | null {
  if (HeureMin <= v && v < HeureMax) {
    return v as Heure;
  }
  return null;
}

export function isMinute(v: int): Minute | null {
  if (0 <= v && v <= 55 && v % 5 == 0) {
    return v as Minute;
  }
  return null;
}

export type error = { err: string; __is_error__: "error" };

export function newError(err: string): error {
  return { err: err, __is_error__: "error" };
}

export function isError<T>(v: T | error): v is error {
  if (typeof v !== "object" || v === null) return false;
  return "__is_error__" in v;
}

export function computeDate(
  firstMonday: Date,
  day: DayIndex,
  horaire: Horaire = { heure: 12, minute: 0 }
) {
  const d = new Date(firstMonday.getTime());
  d.setDate(d.getDate() + day.week * 7 + day.day);
  d.setHours(horaire.heure, horaire.minute);
  return d;
}

// parse Date objects
function reviver<T>(_: string, v: T) {
  if (typeof v != "string") return v;
  // only try to parse ISO string, not "plain" ones like 01/01/2000
  if (v.length < 10 + 1 + 8) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d;
}

export function fromJson<T>(v: string) {
  return JSON.parse(v, reviver) as T;
}

export function copy<T>(v: T) {
  return fromJson<T>(JSON.stringify(v));
}

export type CellValue = Date | string | null;
export type Cell = { value: CellValue; color: string };

/** read all lines, returning a 0-based list of rows */
export async function readExcelFile(file: Blob): Promise<Cell[][]> {
  // read from a stream
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  // ... use workbook
  const sheet = workbook.worksheets[0];
  const rows = sheet.getRows(1, sheet.rowCount) || [];

  return rows.map(collectCells);
}

function collectCells(row: Excel.Row) {
  const out: Cell[] = [];
  row.eachCell({ includeEmpty: true }, (v) =>
    out.push({ value: v.value as CellValue, color: backgroundColor(v) })
  );
  return out;
}

/** returns a #RRGGBB hex color */
function backgroundColor(cell: Excel.Cell) {
  const fill = cell.style.fill;
  let color = "FFFFFFFF";
  if (fill?.type == "pattern") {
    color = (fill.fgColor?.argb ?? fill.bgColor?.argb) || "FFFFFFFF";
  }
  return "#" + color.slice(2);
}

export function arrayEquals<T>(a: T[], b: T[]) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** To simplify checks we normalize the creneaux to a regular 5-min spaced slice */
export namespace TimeGrid {
  /** 0-based index into the grid timeline , represents 5 min */
  export type Index = int;

  export const heures = Array.from({ length: HeureMax - HeureMin }).map(
    (_, i) => (HeureMin + i) as Heure
  );

  export function horaireToIndex(h: Horaire) {
    return (h.heure - HeureMin) * 12 + h.minute / 5;
  }
}
