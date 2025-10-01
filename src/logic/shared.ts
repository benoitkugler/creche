import Excel from "exceljs";

export type int = number;

export type Horaire = {
  heure: Heure;
  minute: Minute;
};

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

export class Range {
  constructor(public debut: Horaire, public fin: Horaire) { }

  static empty() {
    return new Range({ heure: 12, minute: 0 }, { heure: 12, minute: 0 });
  }

  isEmpty() {
    return isBefore(this.fin, this.debut);
  }

  contains(horaire: Horaire) {
    if (this.isEmpty()) return false;
    return isBefore(this.debut, horaire) && isBefore(horaire, this.fin);
  }

  /** returns true if other is (fully) included in this range */
  includes(other: Range) {
    if (other.isEmpty()) return true;
    return isBefore(this.debut, other.debut) && isBefore(other.fin, this.fin);
  }

  /** returns true is the intersection is non empty */
  overlaps(other: Range) {
    const intersection = new Range(
      isBefore(this.debut, other.debut) ? other.debut : this.debut,
      isBefore(this.fin, other.fin) ? this.fin : other.fin
    );
    return !intersection.isEmpty();
  }

  /** renvoie la durée en minutes */
  duration(): int {
    const debutM = this.debut.heure * 60 + this.debut.minute;
    const finM = this.fin.heure * 60 + this.fin.minute;
    return finM - debutM;
  }
}

export function parseHoraire(hour: string, minute: string): Horaire | error {
  const h = isHeure(Number(hour));
  const m = isMinute(Number(minute));
  if (h == null || m == null) {
    return newError("Valeurs d'horaire non supportées");
  }
  return { heure: h, minute: m };
}

// accept dd:dd dd:dd
export function parseRange(cell: string): Range | error {
  const reHoraire = /(\d+):(\d+)\s+(\d+):(\d+)/;
  const match = reHoraire.exec(cell);
  if (match === null) {
    return newError(`Format de plage d'horaires invalide : ${cell}`);
  }
  const debut = parseHoraire(match[1], match[2]);
  if (isError(debut)) return debut;
  const fin = parseHoraire(match[3], match[4]);
  if (isError(fin)) return fin;

  return new Range(debut, fin);
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

export const HeureMin = 6; // inclus
export const HeureMax = 22; // exclus

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

// du lundi au vendredi
export type SemaineOf<T> = [T, T, T, T, T];

export type error = { err: string; __is_error__: "error" };

export function newError(err: string): error {
  return { err: err, __is_error__: "error" };
}

export function isError<T>(v: T | error): v is error {
  if (typeof v !== "object" || v === null) return false;
  return "__is_error__" in v;
}

export type DayIndex = { week: int; day: int };

export function computeDate(
  firstMonday: Date,
  day: DayIndex,
  horaire: Horaire = { heure: 12, minute: 0 }
) {
  const minutesC = 60 * 1000;
  const heureC = 60 * minutesC;
  const dayC = 24 * heureC;
  const semaineC = 7 * dayC;
  return new Date(
    firstMonday.getTime() +
    day.week * semaineC +
    day.day * dayC +
    horaire.heure * heureC +
    horaire.minute * minutesC
  );
}

function reviver<T>(_: string, v: T) {
  // Range
  if (typeof v == "object" && v != null && "__proto__" in v) {
    if ("debut" in v && "fin" in v) {
      return new Range(v.debut as Horaire, v.fin as Horaire);
    }
  }
  if (typeof v != "string") return v;
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

/** read all lines */
export async function readExcelFile(file: Blob) {
  // read from a stream
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  // ... use workbook
  const sheet = workbook.worksheets[0];
  const rows = sheet.getRows(0, sheet.rowCount + 1) || [];

  return rows.map(collectCells)
}

function collectCells(row: Excel.Row) {
  const out: Excel.Cell[] = [];
  row.eachCell({ includeEmpty: true }, (v) => out.push(v));
  return out;
}