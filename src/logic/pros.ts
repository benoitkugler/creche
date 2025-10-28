import {
  isError,
  newError,
  parseHoraire,
  parseRange,
  Range,
  readExcelFile,
  type Cell,
  type CellValue,
  type error,
  type Heure,
  type Horaire,
  type int,
  type SemaineOf,
} from "./shared";

export type Pro = {
  prenom: string;
  color: string; // "#HEX"
  isInterimaire: boolean;
};

export type HoraireTravail = {
  presence: Range;
  pause: Range;
};

export function emptyHoraireTravail(): HoraireTravail {
  return {
    presence: Range.empty(),
    pause: Range.empty(),
  };
}

export type Detachement = { dayIndex: int; horaires: Range };

export type SemainePro = {
  pro: Pro;
  horaires: SemaineOf<HoraireTravail>;
  detachement?: Detachement;
};

export type Reunion = {
  day: int;
  horaire: Horaire; // la durée est toujours d'une heure
};

export type PlanningProsSemaine = {
  week: int; // index (0 based) par rapport au tableau des enfants
  prosHoraires: SemainePro[]; // pour chaque pro
  roulement: int; // index 0-based (entre 0 et 3) du roulement pour cette semaine
  reunion?: Reunion;
};

export type PlanningPros = {
  firstMonday: Date; // convenience field, copied from enfants
  weeks: PlanningProsSemaine[];
};

export namespace Pros {
  /** returns the maximum semaine + 1 */
  export function semaineCount(input: PlanningPros) {
    return Math.max(...input.weeks.map((e) => e.week)) + 1;
  }

  export async function parseExcelPros(
    file: Blob,
    firstMonday: Date
  ): Promise<PlanningPros | error> {
    const rows = await readExcelFile(file);

    const out: PlanningPros = { firstMonday, weeks: [] };
    let currentWeek: PlanningProsSemaine = {
      week: -1,
      prosHoraires: [],
      roulement: -1,
    };

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!row.length) continue;

      // check for Reunion row
      const reunion = isReunionRow(row);
      if (isError(reunion)) return reunion;
      if (reunion != null && currentWeek.week != -1) {
        currentWeek.reunion = reunion;
        continue;
      }

      // detect a week start
      const firstCell = row[0].value;
      if (typeof firstCell != "string") continue;
      if (firstCell.toLowerCase().includes("semaine")) {
        const weekHeader = parseSemaine(firstCell, firstMonday);
        if (isError(weekHeader)) return weekHeader;

        // ignore previous weeks
        if (weekHeader.week < 0) {
          continue;
        }

        // flush the current week if any
        if (currentWeek.week != -1) {
          out.weeks.push(currentWeek);
        }
        currentWeek = {
          week: weekHeader.week,
          roulement: weekHeader.roulement,
          prosHoraires: [],
        }; // start a new week
      } else if (firstCell.trim().length != 0 && currentWeek.week != -1) {
        // this is a pro !
        // fetch the next line
        index += 1;
        if (index >= rows.length)
          return newError("Ligne de pauses manquantes.");
        const res = parseHorairesPros(row, rows[index]);
        if (isError(res)) return newError(`Ligne ${index + 1} : ${res.err}`);
        currentWeek.prosHoraires.push(res);
        // always skip next line to avoid errors
        index += 1;
      }
    }

    // flush the last week if any
    if (currentWeek.prosHoraires.length != 0) {
      out.weeks.push(currentWeek);
    }

    return out;
  }

  export function reunionHoraires(debut: Horaire) {
    return new Range(debut, {
      heure: (debut.heure + 1) as Heure,
      minute: debut.minute,
    });
  }
}

function parseSemaine(
  firstCell: string,
  firstMonday: Date
): { week: int; roulement: int } | error {
  const reSemaine =
    /semaine\s*(\d+)\s*du\s*(\d+)(?:\/\d+)?\s*au\s*(\d+)\/(\d+)\/(\d+)/i;
  const match = reSemaine.exec(firstCell);
  if (match === null)
    return newError("Format de la cellule 'Semaine...' invalide.");
  const roulement = Number(match[1]) - 1; // normalize to 0 based
  const firstDay = Number(match[2]);
  const lastDay = Number(match[3]);
  const lastMonth = Number(match[4]) - 1;
  const lastYear = Number(match[5]);
  if (lastYear >= 1000) return newError("Date invalide.");
  const last = new Date(2000 + lastYear, lastMonth, lastDay);
  if (last.getDay() != 5)
    return newError("Dernier jour invalide (vendredi attendu).");
  const first = new Date(last.getTime());
  first.setDate(first.getDate() - 4);
  if (first.getDate() != firstDay) {
    return newError("Premier jour invalide.");
  }
  const week = Math.round(
    (first.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24 * 7)
  );

  return { week, roulement };
}

function parseHorairesPros(
  rowPresences: Cell[],
  rowPauses: Cell[]
): SemainePro | error {
  if (rowPresences.length < 15 || rowPauses.length < 15) {
    return newError("Ligne trop courte.");
  }

  const firstCell = rowPresences[0];
  const prenom = (firstCell.value as string).trim();
  const pro: Pro = { prenom, color: firstCell.color, isInterimaire: false };
  const d1 = parseHorairesDay(
    rowPresences[1],
    rowPresences[2],
    rowPauses[1],
    rowPauses[2]
  );
  if (isError(d1)) return d1;
  const d2 = parseHorairesDay(
    rowPresences[4],
    rowPresences[5],
    rowPauses[4],
    rowPauses[5]
  );
  if (isError(d2)) return d2;
  const d3 = parseHorairesDay(
    rowPresences[7],
    rowPresences[8],
    rowPauses[7],
    rowPauses[8]
  );
  if (isError(d3)) return d3;
  const d4 = parseHorairesDay(
    rowPresences[10],
    rowPresences[11],
    rowPauses[10],
    rowPauses[11]
  );
  if (isError(d4)) return d4;
  const d5 = parseHorairesDay(
    rowPresences[13],
    rowPresences[14],
    rowPauses[13],
    rowPauses[14]
  );
  if (isError(d5)) return d5;

  return {
    pro,
    horaires: [d1, d2, d3, d4, d5],
  };
}

function parseHorairesDay(
  presenceStart: Cell,
  presenceEnd: Cell,
  pauseStart: Cell,
  pauseEnd: Cell
): HoraireTravail | error {
  const presenceI = parseRangeOrEmpty(presenceStart.value, presenceEnd.value);
  if (isError(presenceI)) return presenceI;
  const pauseI = parseRangeOrEmpty(pauseStart.value, pauseEnd.value);
  if (isError(pauseI)) return pauseI;

  // check inclusion
  if (!presenceI.includes(pauseI)) {
    return newError("Pause non comprise dans les horaires de travail.");
  }
  return { presence: presenceI, pause: pauseI };
}

function parseRangeOrEmpty(
  cellStart: CellValue,
  cellEnd: CellValue
): Range | error {
  if (cellStart instanceof Date) {
    cellStart = cellStart.toISOString().slice(11, 16);
  }
  if (cellEnd instanceof Date) {
    cellEnd = cellEnd.toISOString().slice(11, 16);
  }
  if (typeof cellStart != "string" || cellStart.length == 0) {
    return Range.empty();
  }
  if (typeof cellEnd != "string" || cellEnd.length == 0) {
    return Range.empty();
  }
  const range = `${cellStart} ${cellEnd}`;
  return parseRange(range);
}

function isReunionRow(row: Cell[]): Reunion | error | null {
  const reReunion = /R[é|e]union\s?(\d+)[h|:](\d+)/i;
  for (let index = 0; index < row.length; index++) {
    const cell = row[index].value;
    if (typeof cell != "string") continue;

    const match = reReunion.exec(cell);
    if (!match) continue;
    const horaire = parseHoraire(match[1], match[2]);
    if (isError(horaire)) return horaire;

    const day = Math.round((index - 1) / 3);
    return { day, horaire };
  }
  return null;
}
