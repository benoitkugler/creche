import { Children, type PlanningChildren } from "./enfants";
import { Pros, type HoraireTravail, type PlanningPros } from "./personnel";
import {
  computeDate,
  HeureMax,
  HeureMin,
  isBefore,
  Range,
  type Heure,
  type Horaire,
  type int,
  type Minute,
  type SemaineOf,
} from "./shared";

const marcheursParPro = 8;
const nonMarcheursParPro = 3;

// TODO: que faire d'un groupe mixte avec une seule pro ?

type Diagnostic = { date: Date; check: Check };

export const CheckKind = {
  MissingProAdaption: 0,
  MissingProForEnfants: 1,
  MissingProAtReunion: 2,
  NotEnoughSleep: 3,
} as const;
export type DiagnosticKind = (typeof CheckKind)[keyof typeof CheckKind];

type Check =
  | ({
      kind: (typeof CheckKind)["MissingProAdaption"];
    } & MissingProAdaption)
  | ({
      kind: (typeof CheckKind)["MissingProForEnfants"];
    } & MissingProForEnfants)
  | ({
      kind: (typeof CheckKind)["MissingProAtReunion"];
    } & MissingProAtReunion)
  | ({
      kind: (typeof CheckKind)["NotEnoughSleep"];
    } & NotEnoughSleep);

/** `check` analyze les données fournies et s'assure qu'il y a
 * suffisament de pros à tout moment de la journée.
 *
 * La liste renvoyée est vide si et seulement si aucun problème n'est détecté.
 */
export function check(
  enfants: PlanningChildren,
  pros: PlanningPros
): Diagnostic[] {
  return [];
}

/** To simplify checks we normalize the creneaux to a regular 5-min spaced slice */
export namespace TimeGrid {
  export const Length = 12 * (HeureMax - HeureMin);

  export function horaireToIndex(h: Horaire) {
    return (h.heure - HeureMin) * 12 + minutesToIndex(h.minute);
  }

  export function indexToHoraire(index: int): Horaire {
    const heure = Math.floor(index / 12);
    const minute = index % 12;
    return {
      heure: (HeureMin + heure) as Heure,
      minute: (minute * 5) as Minute,
    };
  }

  export function isIndexInHoraires(horaires: HoraireTravail, index: int) {
    const horaire = indexToHoraire(index);
    return (
      horaires.presence.contains(horaire) && !horaires.pause.contains(horaire)
    );
  }
}

function minutesToIndex(m: Minute): int {
  return m / 5;
}

// semaine -> jour -> découpage by 5min
type Grid<T> = SemaineOf<T[]>[];

export type _EnfantsCount = {
  marcheurCount: int;
  nonMarcheurCount: int;
  adaptionCount: int;
};

export function zeroPresenceEnfants(): _EnfantsCount {
  return {
    marcheurCount: 0,
    nonMarcheurCount: 0,
    adaptionCount: 0,
  };
}

function emptyDayEnfants() {
  return Array.from({ length: TimeGrid.Length }, () => zeroPresenceEnfants());
}

export function _normalizeEnfants(
  input: PlanningChildren
): Grid<_EnfantsCount> {
  const out = Array.from(
    { length: Children.semaineCount(input) },
    () =>
      [
        emptyDayEnfants(),
        emptyDayEnfants(),
        emptyDayEnfants(),
        emptyDayEnfants(),
        emptyDayEnfants(),
      ] as SemaineOf<_EnfantsCount[]>
  );

  for (const enfant of input.enfants) {
    enfant.creneaux.forEach((semaine, iSemaine) => {
      semaine.forEach((day, iDay) => {
        if (day === null) return;
        const currentDay = out[iSemaine][iDay];
        const indexDebut = TimeGrid.horaireToIndex(day.horaires.debut);
        const indexFin = TimeGrid.horaireToIndex(day.horaires.fin);
        for (let index = indexDebut; index < indexFin; index++) {
          if (day.isAdaptation) {
            currentDay[index].adaptionCount += 1;
          } else if (enfant.enfant.isMarcheur) {
            currentDay[index].marcheurCount += 1;
          } else {
            currentDay[index].nonMarcheurCount += 1;
          }
        }
      });
    });
  }

  return out;
}

function emptyDayPros() {
  return Array.from({ length: TimeGrid.Length }, () => 0);
}

export function _normalizePros(input: PlanningPros): Grid<int> {
  const out = Array.from(
    { length: Pros.semaineCount(input) },
    () =>
      [
        emptyDayPros(),
        emptyDayPros(),
        emptyDayPros(),
        emptyDayPros(),
        emptyDayPros(),
      ] as SemaineOf<int[]>
  );

  input.semaines.forEach((semaine) => {
    const iSemaine = semaine.semaine;
    semaine.prosHoraires.forEach((pro) => {
      pro.horaires.forEach((day, iDay) => {
        const currentDay = out[iSemaine][iDay];
        // gestion de la pause : 2 plages
        const indexDebut1 = TimeGrid.horaireToIndex(day.presence.debut);
        const indexFin1 = TimeGrid.horaireToIndex(day.pause.debut);
        for (let index = indexDebut1; index < indexFin1; index++) {
          currentDay[index] += 1;
        }
        const indexDebut2 = TimeGrid.horaireToIndex(day.pause.fin);
        const indexFin2 = TimeGrid.horaireToIndex(day.presence.fin);
        for (let index = indexDebut2; index < indexFin2; index++) {
          currentDay[index] += 1;
        }
      });
    });
  });

  return out;
}

type MissingProAdaption = { got: int; expect: int };
type MissingProForEnfants = { got: int; expect: int };

// TODO: check and document the rules
export function _checkEnfantsCount(
  enfants: _EnfantsCount,
  pros: int
): Check | undefined {
  // adaption requires a full pro
  if (enfants.adaptionCount > pros) {
    return {
      kind: CheckKind.MissingProAdaption,
      got: pros,
      expect: enfants.adaptionCount,
    };
  }
  pros -= enfants.adaptionCount;

  // special case for 1 pro
  if (pros <= 1) {
    if (enfants.marcheurCount + enfants.nonMarcheurCount > 3) {
      return {
        kind: CheckKind.MissingProForEnfants,
        got: pros,
        expect: 2,
      };
    }
  }

  // attribute the non Marcheurs, and fill with marcheurs
  let prosForNonMarcheurs = Math.floor(
    enfants.nonMarcheurCount / nonMarcheursParPro
  );
  let marcheursToAttribute = enfants.marcheurCount;
  const remainingNonMarcheurs = enfants.nonMarcheurCount % nonMarcheursParPro;
  if (remainingNonMarcheurs != 0) {
    // "groupe mixte"
    prosForNonMarcheurs += 1;
    const placesToFill = 3 - remainingNonMarcheurs;
    marcheursToAttribute -= placesToFill;
  }
  let otherPros = 0;
  if (marcheursToAttribute > 0) {
    otherPros = Math.ceil(marcheursToAttribute / marcheursParPro);
  }
  if (prosForNonMarcheurs + otherPros > pros) {
    return {
      kind: CheckKind.MissingProForEnfants,
      got: pros,
      expect: prosForNonMarcheurs + otherPros,
    };
  }

  // all good !
  return;
}

type WrongDepartArriveePro = {
  time: "first-arrival" | "second-arrival" | "last-go";
  expected: Horaire;
  got: Horaire;
};

// Enf3 : La première pro doit arriver 15 min avant le premier enfant, la deuxième pro 15 min avant le 4° enfant.
// Enf4 : Une et une seule pro reste 15 min après le dernier enfant.
export function _checkProsArrivals(enfants: _EnfantsCount[], pros: int[]) {
  const out: WrongDepartArriveePro[] = [];

  // first arrival
  const indexFirstChild = enfants.findIndex(
    (c) => c.adaptionCount + c.marcheurCount + c.nonMarcheurCount > 0
  );
  // if there is no kids, all good !
  if (indexFirstChild == -1) return;

  const expectedFirstPro = indexFirstChild - minutesToIndex(15);
  const indexFirstPro = pros.findIndex((p) => p != 0);
  if (expectedFirstPro != indexFirstPro) {
    out.push({
      time: "first-arrival",
      expected: TimeGrid.indexToHoraire(expectedFirstPro),
      got: TimeGrid.indexToHoraire(indexFirstPro),
    });
  }

  // second arrival
  const indexFourthChild = enfants.findIndex(
    (c) => c.adaptionCount + c.marcheurCount + c.nonMarcheurCount >= 4
  );
  if (indexFourthChild != -1) {
    const expectedSecondPro = indexFourthChild - minutesToIndex(15);
    const indexSecondPro = pros.findIndex((p) => p >= 2);
    if (expectedSecondPro != indexSecondPro) {
      out.push({
        time: "second-arrival",
        expected: TimeGrid.indexToHoraire(expectedSecondPro),
        got: TimeGrid.indexToHoraire(indexSecondPro),
      });
    }
  }

  // TODO:
  const indexLastChild = enfants.findLastIndex(
    (c) => c.adaptionCount + c.marcheurCount + c.nonMarcheurCount > 0
  );

  return out;
}

type MissingProAtReunion = { got: int; expect: int };

export function _checkReunion(pros: PlanningPros): Diagnostic[] {
  const reunionDayIndex = 1; // index in week, mardi
  const horaireReunion = new Range(
    { heure: 13, minute: 30 },
    { heure: 14, minute: 30 }
  );

  const out: Diagnostic[] = [];

  const grid = _normalizePros(pros);
  for (const semaine of pros.semaines) {
    const prosCount = semaine.prosHoraires.length; // total number of pros this week
    const reunionDay = grid[semaine.semaine][reunionDayIndex]; // day of the reunion in this week
    // select the reunion horaire and check
    const indexStart = TimeGrid.horaireToIndex(horaireReunion.debut);
    const indexEnd = TimeGrid.horaireToIndex(horaireReunion.fin);
    for (let index = indexStart; index < indexEnd; index++) {
      const prosPresent = reunionDay[index];
      if (prosPresent < prosCount) {
        const horaire = TimeGrid.indexToHoraire(index);
        out.push({
          date: computeDate(
            pros.firstMonday,
            { week: semaine.semaine, day: reunionDayIndex },
            horaire
          ),
          check: {
            kind: CheckKind.MissingProAtReunion,
            expect: prosCount,
            got: prosPresent,
          },
        });
        break; // only one diagnostic per week
      }
    }
  }

  return out;
}

type NotEnoughSleep = { expectedLendemain: Horaire; gotLendemain: Horaire };

export function _checkRepos(pros: PlanningPros): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const semaine of pros.semaines) {
    for (const pro of semaine.prosHoraires) {
      for (let iDay = 0; iDay < 4; iDay++) {
        const c = _checkReposNight(
          pro.horaires[iDay].presence,
          pro.horaires[iDay + 1].presence
        );
        if (c === undefined) continue;
        out.push({
          date: computeDate(
            pros.firstMonday,
            { week: semaine.semaine, day: iDay },
            pro.horaires[iDay].presence.fin
          ),
          check: { kind: CheckKind.NotEnoughSleep, ...c },
        });
      }
    }
  }
  return out;
}

function _checkReposNight(
  day: Range,
  following: Range
): NotEnoughSleep | undefined {
  if (day.isEmpty() || following.isEmpty()) {
    // empty day, all good !
    return;
  }
  const expectedRepos = 11; // heures
  const lendemain: Horaire = {
    heure: (day.fin.heure + expectedRepos - 24) as Heure,
    minute: day.fin.minute,
  };
  if (isBefore(lendemain, following.debut)) {
    // all good!
    return;
  }
  return { expectedLendemain: lendemain, gotLendemain: following.debut };
}
