import {
  computeDate,
  type DayIndex,
  type error,
  isError,
  newError,
  Range,
  type SemaineOf,
} from "./shared";

export type Child = {
  nom: string;
  dateNaissance: string; // maybe empty
  isMarcheur: boolean;
};

export type CreneauEnfant = { horaires: Range; isAdaptation: boolean };

type CreneauxEnfant = SemaineOf<CreneauEnfant | null>[];

export type PlanningChildren = {
  firstMonday: Date; // lien avec le calendrier réel
  children: { child: Child; creneaux: CreneauxEnfant }[];
};

export namespace Children {
  /** returns the maximum semaine */
  export function semaineCount(input: PlanningChildren) {
    return Math.max(...input.children.map((e) => e.creneaux.length));
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
    for (const enfant of input.children) {
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
    // monkey patch upstream PDF error (pending a better solution)
    texts.forEach((t) => (t.Text = t.Text.replaceAll("08:03", "08:00")));

    if (!texts.length) return newError("Document invalide (aucun text).");
    if (!texts[0].Text.includes("PLANNING MENSUEL"))
      return newError("Document invalide ('PLANNING MENSUEL' manquant).");
    const t = parseMonth(texts[0].Text);
    if (isError(t)) return t;

    texts = texts.slice(1);
    const [header, ...rows] = detectRows(texts);

    const firstDay = parseDay(t.month, t.year, header[1].Text);
    // discard first column and two last which are totals
    const daysX = header.slice(1, -2).map((t) => t.X);
    const daysCount = daysX.length;
    const weekCount = Math.ceil(daysCount / 7);

    const firstDayDay = firstDay.getDay();
    const offset = firstDayDay - 1;
    const firstMonday = new Date(
      firstDay.getTime() - offset * 24 * 60 * 60 * 1000
    );

    const out: PlanningChildren = { firstMonday, children: [] };
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
      for (const day of trimAtLastHoraire(childRow.slice(1))) {
        // find the closest day
        let [bestIndex, bestDistance] = [0, 1e100];
        daysX.forEach((x, index) => {
          const distance = Math.abs(x - day.X);
          if (distance < bestDistance) {
            bestIndex = index;
            bestDistance = distance;
          }
        });

        const res = Range.parse(day.Text);
        if (isError(res)) return res;

        // index --> semaine and weekday
        const index = bestIndex + offset;
        const semaineI = Math.floor(index / 7);
        const dayI = index % 7;
        if (dayI >= 5) continue; // ignore Samedi & Dimanche

        creneaux[semaineI][dayI] = { horaires: res, isAdaptation: false };
      }

      out.children.push({ child: enfant, creneaux });
    }

    // the first week may be empty if the 01 is a Saturday or Sunday:
    // remove it and shift firstMonday
    if (firstDayDay == 6 || firstDayDay == 7) {
      out.firstMonday.setDate(out.firstMonday.getDate() + 7);
      out.children.forEach((enfant) => enfant.creneaux.splice(0, 1));
    }
    return out;
  }
}

export type TextBlock = {
  X: number;
  Y: number;
  Text: string;
};

// discard the end of the cells by ending at the last ":"
function trimAtLastHoraire(cells: TextBlock[]) {
  const reHoraire = /(\d+):(\d+)/;
  const end = cells.findLastIndex((t) => reHoraire.test(t.Text));
  return cells.slice(0, end + 1);
}

function detectRows(texts: TextBlock[]) {
  texts = trimAtLastHoraire(texts);

  const firstX = texts.map((t) => t.X).sort((a, b) => a - b)[0];
  const firstColumn = texts.filter((t) => t.X <= firstX + 50); // cell is about 100 long
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
  // handle last line : the remaining of texts
  const lastRow = texts;
  lastRow.sort((a, b) => a.X - b.X);
  rows.push(lastRow);

  return rows;
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
  const reMonth = /Mois (?:de|d')\s?(\w+) (\d+)/;
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

function parseChild(cell: string): Child {
  cell = cell.trim();

  const hasDate = cell.length >= 10 && cell.includes("/");
  const dateNaissance = hasDate ? cell.substring(cell.length - 10) : "";

  const nom = cell
    .substring(0, hasDate ? cell.length - 10 : undefined)
    .trim()
    .replace("\n", " ")
    .replace("  ", " ");
  return { nom, dateNaissance, isMarcheur: false };
}
