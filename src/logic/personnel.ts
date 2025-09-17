import type { CellValue, Row } from "read-excel-file";
import {
  emptyRange,
  isHeure,
  isMinute,
  type error,
  type int,
  type Range,
  type SemaineOf
} from "./shared";

export type Pro = {
  prenom: string;
};

type HoraireTravail = {
  presence: Range;
  pause: Range;
};

type SemainePro = {
  pro: Pro;
  horaires: [
    HoraireTravail,
    HoraireTravail,
    HoraireTravail,
    HoraireTravail,
    HoraireTravail
  ];
};

type PlanningProsSemaine = {
  semaine: int; // index (0 based) par rapport au tableau des enfants
  prosHoraires: SemainePro[]; // pour chaque pro
};

export type PlanningPros = {
  firstMonday: Date; // convenience field, copied from enfants
  semaines: PlanningProsSemaine[];
};

export namespace Pros {
  /** returns the maximum semaine + 1 */
  export function semaineCount(input: PlanningPros) {
    return Math.max(...input.semaines.map(e => e.semaine)) + 1;
  }

  /** You should use `readXlsxFile` to produce rows */
  export function parseExcel(
    rows: Row[],
    firstMonday: Date
  ): [PlanningPros, error] {
    const out: PlanningPros = { firstMonday, semaines: [] };
    let currentWeek: PlanningProsSemaine = { semaine: -1, prosHoraires: [] };

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!row.length) continue;

      // detect a week start
      const firstCell = row[0];
      if (typeof firstCell != "string") continue;
      if (firstCell.toLowerCase().includes("semaine")) {
        const [semaine, err] = parseSemaine(firstCell, firstMonday);
        if (err.length) return [out, err];

        // flush the current week if any
        if (currentWeek.semaine != -1) {
          out.semaines.push(currentWeek);
        }
        currentWeek = { semaine, prosHoraires: [] }; // start a new week
      } else if (firstCell.trim().length != 0 && currentWeek.semaine != -1) {
        // this is a pro !
        // fetch the next line
        index += 1;
        if (index >= rows.length) return [out, "Ligne de pauses manquantes."];
        const res = parseHorairesPros(row, rows[index]);
        if (typeof res == "string") {
          return [out, res];
        }
        currentWeek.prosHoraires.push(res);
      }
    }

    // flush the last week if any
    if (currentWeek.prosHoraires.length != 0) {
      out.semaines.push(currentWeek);
    }

    return [out, ""];
  }
}

function parseSemaine(firstCell: string, firstMonday: Date): [int, string] {
  const reSemaine =
    /semaine\s*\d+\s*du\s*(\d+)\/(\d+)\s*au\s*(\d+)\/(\d+)\/(\d+)/i;
  const match = reSemaine.exec(firstCell);
  if (match === null) return [0, "Format de la cellule 'Semaine...' invalide."];
  const firstDay = Number(match[1]);
  const firstMonth = Number(match[2]) - 1;
  const lastDay = Number(match[3]);
  const lastMonth = Number(match[4]) - 1;
  const lastYear = Number(match[5]);
  if (lastYear >= 1000) return [0, "Date invalide."];
  const last = new Date(2000 + lastYear, lastMonth, lastDay);
  if (last.getDay() != 5)
    return [0, "Dernier jour invalide (vendredi attendu)."];
  const first = new Date(last.getTime());
  first.setDate(first.getDate() - 4);
  if (first.getDate() != firstDay || first.getMonth() != firstMonth) {
    return [0, "Premier jour invalide."];
  }
  const semaine =
    (first.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24 * 7);
  if (semaine < 0) {
    return [0, "Semaine antérieure au début du planning enfants."];
  }
  return [semaine, ""];
}

function parseHorairesPros(row: Row, pauses: Row): SemainePro | error {
  if (row.length < 10 || pauses.length < 10) {
    return "Ligne trop courte.";
  }
  const pro: Pro = { prenom: (row[0] as string).trim() };
  const horaires = [
    parseHorairesDay(row[1], pauses[1]),
    parseHorairesDay(row[3], pauses[3]),
    parseHorairesDay(row[5], pauses[5]),
    parseHorairesDay(row[7], pauses[7]),
    parseHorairesDay(row[9], pauses[9])
  ] as SemaineOf<HoraireTravail>;
  return { pro, horaires };
}

function parseHorairesDay(
  presence: CellValue,
  pause: CellValue
): HoraireTravail {
  return {
    presence: parseIntervalle(presence),
    pause: parseIntervalle(pause)
  };
}

function parseIntervalle(cell: CellValue): Range {
  if (typeof cell != "string" || cell.length == 0) {
    return emptyRange();
  }
  const reHoraire = /(\d+):(\d+)\s+(\d+):(\d+)/;
  const match = reHoraire.exec(cell);
  if (match === null) return emptyRange();
  const debutHour = isHeure(Number(match[1]));
  const debutMinute = isMinute(Number(match[2]));
  const finHour = isHeure(Number(match[3]));
  const finMinute = isMinute(Number(match[4]));
  if (
    debutHour == null ||
    debutMinute == null ||
    finHour == null ||
    finMinute == null
  ) {
    return emptyRange();
  }
  return {
    debut: { heure: debutHour, minute: debutMinute },
    fin: { heure: finHour, minute: finMinute }
  };
}
