import {
  computeDate,
  type DayIndex,
  type error,
  isError,
  newError,
  parseRange,
  type Range,
  type SemaineOf,
} from "./shared";

export type Enfant = {
  nom: string;
  dateNaissance: Date;
  isMarcheur: boolean;
};

export type CreneauEnfant = { horaires: Range; isAdaptation: boolean };

type CreneauxEnfant = SemaineOf<CreneauEnfant | null>[];

export type PlanningChildren = {
  firstMonday: Date; // lien avec le calendrier réel
  enfants: { enfant: Enfant; creneaux: CreneauxEnfant }[];
};

export namespace Enfants {
  /** returns the maximum semaine */
  export function semaineCount(input: PlanningChildren) {
    return Math.max(...input.enfants.map((e) => e.creneaux.length));
  }

  function _firstDay(creneaux: CreneauxEnfant): DayIndex | null {
    for (let iSemaine = 0; iSemaine < creneaux.length; iSemaine++) {
      const semaine = creneaux[iSemaine]!;
      for (let iDay = 0; iDay < semaine.length; iDay++) {
        const day = semaine[iDay];
        if (day != null) {
          return { week: iSemaine, day: iDay };
        }
      }
    }
    return null;
  }

  /** returns the actual first day (which also specifies the month) */
  export function firstDay(input: PlanningChildren) {
    const days = [];
    for (const enfant of input.enfants) {
      const day = _firstDay(enfant.creneaux);
      if (day == null) continue;
      days.push(computeDate(input.firstMonday, day));
    }
    days.sort((a, b) => a.getTime() - b.getTime());
    return days[0];
  }

  export function parsePDFEnfants(
    texts: TextBlock[]
  ): PlanningChildren | error {
    if (!texts.length) return newError("Document invalide.");
    if (!texts[0].Text.includes("PLANNING MENSUEL"))
      return newError("Document invalide.");
    const t = parseMonth(texts[0].Text);
    if (isError(t)) return t;

    texts = texts.slice(1);
    const [header, ...rows] = detectRows(texts);
    const firstDay = parseDay(t.month, t.year, header[1].Text);
    // discard first column and two last which are totals
    const daysX = header.slice(1, -2).map((t) => t.X);
    const weekCount = Math.ceil(daysX.length / 7);

    const firstDayDay = firstDay.getDay();
    const offset = firstDayDay - 1;
    const firstMonday = new Date(
      firstDay.getTime() - offset * 24 * 60 * 60 * 1000
    );

    const out: PlanningChildren = { firstMonday, enfants: [] };
    for (const childRow of rows) {
      const enfant = parseChild(childRow[0].Text);

      const creneaux: CreneauxEnfant = Array.from({ length: weekCount }, () => [
        null,
        null,
        null,
        null,
        null,
      ]);
      // discard first column and two last which are totals
      for (const day of childRow.slice(1, -2)) {
        // find the closest day
        let [bestIndex, bestDistance] = [0, 1e100];
        daysX.forEach((x, index) => {
          const distance = Math.abs(x - day.X);
          if (distance < bestDistance) {
            bestIndex = index;
            bestDistance = distance;
          }
        });

        const res = parseRange(day.Text);
        if (isError(res)) return res;

        // index --> semaine and weekday
        const index = bestIndex + offset;
        const semaineI = Math.floor(index / 7);
        const dayI = index % 7;
        if (dayI >= 5) continue; // ignore Samedi & Dimanche

        creneaux[semaineI][dayI] = { horaires: res, isAdaptation: false };
      }

      out.enfants.push({ enfant, creneaux });
    }
    return out;
  }
}

export type TextBlock = {
  X: number;
  Y: number;
  Text: string;
};

// discard two last lines, unused
function detectRows(texts: TextBlock[]) {
  const firstX = texts.map((t) => t.X).sort((a, b) => a - b)[0];
  const firstColumn = texts.filter((t) => t.X <= firstX + 50); // cell in about 100 long
  firstColumn.sort((a, b) => a.Y - b.Y);
  // split the whole list according to Y value
  const rows: TextBlock[][] = [];
  firstColumn.forEach((cell, index) => {
    if (index == 0) return; // skip first line
    // extract everything above next line : this is the previous row
    const row = texts.filter((t) => t.Y < cell.Y - 10);
    row.sort((a, b) => a.X - b.X);
    rows.push(row);

    // remove the extracted row
    texts = texts.filter((t) => t.Y >= cell.Y - 10);
  });
  // discard two last lines, unused
  return rows.slice(0, -1);
}

export const months = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function parseMonth(s: string): { month: number; year: number } | error {
  const reMonth = /Mois de (\w+) (\d+)/;
  const res = reMonth.exec(s);
  if (res === null) return newError("Entête du document invalide.");
  const [_, monthS, yearS] = res;
  const month = months.indexOf(monthS.toLowerCase().trim());
  const year = Number(yearS);
  return { month, year };
}

function parseDay(month: number, year: number, s: string): Date {
  // l 01
  const day = Number(s.trim().substring(1).trim());
  return new Date(year, month, day);
}

function parseChild(cell: string): Enfant {
  cell = cell.trim();

  const dateString = cell.substring(cell.length - 10);
  const parts = dateString.split("/");
  const dateNaissance = new Date(
    parseInt(parts[2]),
    parseInt(parts[1]) - 1,
    parseInt(parts[0])
  );

  const nom = cell
    .substring(0, cell.length - 10)
    .trim()
    .replace("\n", " ");
  return { nom, dateNaissance, isMarcheur: false };
}
