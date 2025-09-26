import { Children, type PlanningChildren } from "./enfants";
import {
  Pros,
  type HoraireTravail,
  type PlanningPros,
  type Pro,
} from "./personnel";
import {
  HeureMax,
  HeureMin,
  isBefore,
  Range,
  type DayIndex,
  type Heure,
  type Horaire,
  type int,
  type Minute,
  type SemaineOf,
} from "./shared";

export type Diagnostic = {
  dayIndex: DayIndex;
  horaireIndex: int;
  check: Check;
};

export const CheckKind = {
  MissingProAdaption: 0,
  MissingProForEnfants: 1,
  MissingProAtReunion: 2,
  NotEnoughSleep: 3,
  MissingPause: 4,
  WrongPauseDuration: 5,
  WrongPauseHoraire: 6,
  WrongDepartArriveePro: 7,
  WrongAdaptationHoraire: 8,
} as const;
export type CheckKind = (typeof CheckKind)[keyof typeof CheckKind];

export type Check =
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
    } & NotEnoughSleep)
  | ({
      kind: (typeof CheckKind)["MissingPause"];
    } & MissingPause)
  | ({
      kind: (typeof CheckKind)["WrongPauseDuration"];
    } & WrongPauseDuration)
  | ({
      kind: (typeof CheckKind)["WrongPauseHoraire"];
    } & WrongPauseHoraire)
  | ({
      kind: (typeof CheckKind)["WrongDepartArriveePro"];
    } & WrongDepartArriveePro)
  | ({
      kind: (typeof CheckKind)["WrongAdaptationHoraire"];
    } & WrongAdaptationHoraire);

/** This user-friendly list documents the various checks implemented in this file. */
export const CheckDescription = [
  [
    "Enfants 1",
    "Une pro seule doit avoir au maximum 3 enfants (marcheurs ou non).",
  ],
  [
    "Enfants 2",
    "A partir de deux pros, le maximum d’enfants par pro est 5 non-marcheurs ou 8 marcheurs. Un enfant marcheur peut compléter un groupe de non-marcheurs.",
  ],
  [
    "Détachement",
    "Une pro marquée en détachement ne peut pas s’occuper d’enfants.",
  ],
  [
    "Arrivée",
    "La première pro doit arriver 15 min avant le premier enfant, la deuxième pro 15 min avant le 4° enfant.",
  ],
  [
    "Départ",
    "L’avant-dernière pro doit partir 15 min après le 4° enfant restant, la dernière pro 30 min après le dernier enfant. ",
  ],
  ["Adaptation 1", "Une adaptation occupe une pro à part entière."],
  [
    "Adaptation 2",
    "Une adaptation doit se produire dans les créneaux suivants : 9h30 à 11h30, 10h à 12h30, 13h à 15h30 ou 14h30 à 16h45",
  ],
  [
    "Pause 1",
    "Chaque pro doit avoir entre 30 min et 1h de pause, à partir de 6h de travail.",
  ],
  [
    "Pause 2",
    "Pour strictement moins de 6h de travail, si l’arrivée est entre 11h et 12h, une pro doit avoir une pause.",
  ],
  ["Pause 3", "Aucune pause entre 11h30 et 13h (à cause des repas)."],
  [
    "Réunion 1",
    "Toutes les pro doivent être présentes le mardi de 13h30 à 14h30.",
  ],
  ["Réunion 2", "Sur ce créneau, les enfants sont considérés comme gardés."],

  [
    "Repos",
    "Il doit y avoir au moins 11h de repos entre la fin d’un service et le début du prochain.",
  ],
] as const;

/** `check` analyze les données fournies et s'assure notamment qu'il y a
 * suffisament de pros à tout moment de la journée.
 *
 * La liste renvoyée est vide si et seulement si aucun problème n'est détecté.
 */
export function check(
  children: PlanningChildren,
  pros: PlanningPros
): Diagnostic[] {
  const normalizedChildren = _normalizeChildren(children);
  const normalizedPros = _normalizePros(pros);

  const out: Diagnostic[] = [];
  normalizedPros.forEach((week, weekI) => {
    week.forEach((dayPros, dayI) => {
      const dayChildren = normalizedChildren[weekI][dayI];
      const dayIndex = { week: weekI, day: dayI };

      // Enfants 1, Enfants 2 et Reunion 2, Adaptation 1
      for (let timeI = 0; timeI < dayChildren.length; timeI++) {
        const count = dayChildren[timeI];
        if (horairesReunion.contains(TimeGrid.indexToHoraire(timeI))) {
          continue;
        }
        const pros = dayPros[timeI];
        const check = _checkEnfantsCount(count, pros);
        if (check !== undefined) {
          out.push({
            dayIndex,
            horaireIndex: timeI,
            check,
          });
          break; // only include one check by day
        }
      }

      // Arrivée et départ
      const l = _checkProsArrivals(dayChildren, dayPros);
      out.push(
        ...l.map((c) => ({
          dayIndex,
          horaireIndex: 0,
          check: { kind: CheckKind.WrongDepartArriveePro, ...c },
        }))
      );
    });
  });

  // Adaptation 2
  children.enfants.forEach((child) => {
    child.creneaux.forEach((week, weekI) => {
      week.forEach((day, dayI) => {
        if (day == null || !day.isAdaptation) return;

        const c = _checkAdaptationHoraires(day.horaires);
        if (c !== undefined) {
          out.push({
            dayIndex: { week: weekI, day: dayI },
            horaireIndex: 0,
            check: { kind: CheckKind.WrongAdaptationHoraire, ...c },
          });
        }
      });
    });
  });

  // Pause 1, Pause2 et Pause3
  pros.semaines.forEach((semaine) => {
    semaine.prosHoraires.forEach((semainePro) => {
      semainePro.horaires.forEach((day, dayI) => {
        out.push(
          ..._checkPauses(
            { week: semaine.week, day: dayI },
            semainePro.pro,
            day
          )
        );
      });
    });
  });

  // Reunion 1
  out.push(..._checkReunion(pros));

  // Repos
  out.push(..._checkRepos(pros));

  return out;
}

/** To simplify checks we normalize the creneaux to a regular 5-min spaced slice */
export namespace TimeGrid {
  /** 0-based index into the grid timeline  */
  export type Index = int;

  export const Length = 12 * (HeureMax - HeureMin);

  export function horaireToIndex(h: Horaire) {
    return (h.heure - HeureMin) * 12 + minutesToIndex(h.minute);
  }

  export function indexToHoraire(index: Index): Horaire {
    const heure = Math.floor(index / 12);
    const minute = index % 12;
    return {
      heure: (HeureMin + heure) as Heure,
      minute: (minute * 5) as Minute,
    };
  }

  export function isIndexInHoraires(horaires: HoraireTravail, index: Index) {
    const horaire = indexToHoraire(index);
    return (
      horaires.presence.contains(horaire) && !horaires.pause.contains(horaire)
    );
  }

  export function rangeToBounds(range: Range) {
    return [
      TimeGrid.horaireToIndex(range.debut),
      TimeGrid.horaireToIndex(range.fin),
    ];
  }

  export function rangeToIndexes(range: Range): ReadonlyArray<TimeGrid.Index> {
    const [start, end] = rangeToBounds(range);
    return [...Array(end - start).keys()].map((i) => i + start);
  }
}

function minutesToIndex(m: Minute): int {
  return m / 5;
}

// semaine -> jour -> découpage by 5min
type Grid<T> = SemaineOf<T[]>[];

export class ChildrenCount {
  constructor(
    public marcheurCount: int,
    public nonMarcheurCount: int,
    public adaptionCount: int
  ) {}

  static zero() {
    return new ChildrenCount(0, 0, 0);
  }

  count() {
    return this.marcheurCount + this.nonMarcheurCount + this.adaptionCount;
  }
}

function emptyDayEnfants() {
  return Array.from({ length: TimeGrid.Length }, () => ChildrenCount.zero());
}

export function _normalizeChildren(
  input: PlanningChildren
): Grid<ChildrenCount> {
  const out = Array.from(
    { length: Children.semaineCount(input) },
    () =>
      [
        emptyDayEnfants(),
        emptyDayEnfants(),
        emptyDayEnfants(),
        emptyDayEnfants(),
        emptyDayEnfants(),
      ] as SemaineOf<ChildrenCount[]>
  );

  for (const enfant of input.enfants) {
    enfant.creneaux.forEach((semaine, iSemaine) => {
      semaine.forEach((day, iDay) => {
        if (day === null) return;
        const currentDay = out[iSemaine][iDay];
        for (const index of TimeGrid.rangeToIndexes(day.horaires)) {
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
    const iSemaine = semaine.week;
    semaine.prosHoraires.forEach((pro) => {
      pro.horaires.forEach((day, iDay) => {
        const currentDay = out[iSemaine][iDay];
        const [pauseStart, pauseEnd] = TimeGrid.rangeToBounds(day.pause);
        for (const index of TimeGrid.rangeToIndexes(day.presence)) {
          // gestion de la pause : 2 plages (attention au plages vides)
          if (pauseStart <= index && index < pauseEnd) continue;
          currentDay[index] += 1;
        }
      });
      // handle detachement
      if (pro.detachement) {
        const currentDay = out[iSemaine][pro.detachement.dayIndex];
        for (const index of TimeGrid.rangeToIndexes(pro.detachement.horaires)) {
          currentDay[index] -= 1;
        }
      }
    });
  });

  return out;
}

type MissingProAdaption = { got: int; expect: int };
type MissingProForEnfants = { got: int; expect: int };

export function _checkEnfantsCount(
  enfants: ChildrenCount,
  pros: int
): Check | undefined {
  const marcheursParPro = 8;
  const nonMarcheursParPro = 3;

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

type WrongAdaptationHoraire = {
  got: Range;
};

export function _checkAdaptationHoraires(
  childHoraires: Range
): WrongAdaptationHoraire | undefined {
  const accepted = [
    new Range({ heure: 9, minute: 30 }, { heure: 11, minute: 30 }),
    new Range({ heure: 10, minute: 0 }, { heure: 12, minute: 30 }),
    new Range({ heure: 13, minute: 0 }, { heure: 15, minute: 30 }),
    new Range({ heure: 14, minute: 30 }, { heure: 16, minute: 45 }),
  ] as const;
  for (const ok of accepted) {
    if (ok.includes(childHoraires)) {
      // all good
      return;
    }
  }
  return { got: childHoraires };
}

type WrongDepartArriveePro = {
  moment: "first-arrival" | "second-arrival" | "before-last-go" | "last-go";
  expected: Horaire;
  got: Horaire;
};

// Arrivee: La première pro doit arriver 15 min avant le premier enfant, la deuxième pro 15 min avant le 4° enfant.
// Depart: L’avant-dernière pro doit partir 15 min après le 4° enfant restant, la dernière pro 30 min après le dernier enfant.
export function _checkProsArrivals(enfants: ChildrenCount[], pros: int[]) {
  const out: WrongDepartArriveePro[] = [];

  // first arrival
  const indexFirstChild = enfants.findIndex((c) => c.count() > 0);
  // if there is no kids, all good !
  if (indexFirstChild == -1) return [];

  const expectedFirstPro = indexFirstChild - minutesToIndex(15);
  const indexFirstPro = pros.findIndex((p) => p != 0);
  if (expectedFirstPro != indexFirstPro) {
    out.push({
      moment: "first-arrival",
      expected: TimeGrid.indexToHoraire(expectedFirstPro),
      got: TimeGrid.indexToHoraire(indexFirstPro),
    });
  }

  // last go
  const indexLastChild = enfants.findLastIndex((c) => c.count() > 0);
  const expectedLastPro = indexLastChild + minutesToIndex(30);
  const indexLastPro = pros.findLastIndex((p) => p != 0);
  if (expectedLastPro != indexLastPro) {
    out.push({
      moment: "last-go",
      expected: TimeGrid.indexToHoraire(expectedLastPro),
      got: TimeGrid.indexToHoraire(indexLastPro),
    });
  }

  // second arrival
  const indexFourthChild = enfants.findIndex((c) => c.count() >= 4);
  if (indexFourthChild == -1) {
    // never more than 3; nothing to check
    return out;
  }

  const expectedSecondPro = indexFourthChild - minutesToIndex(15);
  const indexSecondPro = pros.findIndex((p) => p >= 2);
  if (expectedSecondPro != indexSecondPro) {
    out.push({
      moment: "second-arrival",
      expected: TimeGrid.indexToHoraire(expectedSecondPro),
      got: TimeGrid.indexToHoraire(indexSecondPro),
    });
  }

  // before last go
  const indexLastFourthChild = enfants.findLastIndex((c) => c.count() >= 4);
  const expectedBeforeLastPro = indexLastFourthChild + minutesToIndex(15);
  const indexBeforeLastPro = pros.findLastIndex((p) => p >= 2);
  if (expectedBeforeLastPro != indexBeforeLastPro) {
    out.push({
      moment: "before-last-go",
      expected: TimeGrid.indexToHoraire(expectedBeforeLastPro),
      got: TimeGrid.indexToHoraire(indexBeforeLastPro),
    });
  }

  return out;
}

type MissingPause = { pro: Pro };
type WrongPauseDuration = { pro: Pro; got: int };
type WrongPauseHoraire = { pro: Pro; got: Range };

export function _checkPauses(
  dayIndex: DayIndex,
  pro: Pro,
  horaires: HoraireTravail
): Diagnostic[] {
  const thresholdInMinutes = 6 * 60;
  const arrivalInMeal = new Range(
    { heure: 11, minute: 0 },
    { heure: 12, minute: 0 }
  );

  const repas = new Range({ heure: 11, minute: 30 }, { heure: 13, minute: 0 });
  if (horaires.pause.isEmpty()) {
    // check it was not mandatory
    const workDuration = horaires.presence.duration();
    const isPauseMandatory =
      workDuration >= thresholdInMinutes ||
      arrivalInMeal.contains(horaires.presence.debut);

    if (isPauseMandatory) {
      return [
        {
          dayIndex,
          horaireIndex: TimeGrid.horaireToIndex(horaires.pause.debut),
          check: {
            kind: CheckKind.MissingPause,
            pro,
          },
        },
      ];
    }
    return [];
  }

  // check the pause is valid
  const out: Diagnostic[] = [];
  if (repas.overlaps(horaires.pause)) {
    out.push({
      dayIndex,
      horaireIndex: TimeGrid.horaireToIndex(horaires.pause.debut),
      check: {
        kind: CheckKind.WrongPauseHoraire,
        pro,
        got: horaires.pause,
      },
    });
  }

  const duration = horaires.pause.duration();
  if (duration < 30 || duration > 60) {
    out.push({
      dayIndex,
      horaireIndex: TimeGrid.horaireToIndex(horaires.pause.debut),
      check: {
        kind: CheckKind.WrongPauseDuration,
        pro,
        got: duration,
      },
    });
  }

  return out;
}

type MissingProAtReunion = { got: int; expect: int };

const horairesReunion = new Range(
  { heure: 13, minute: 30 },
  { heure: 14, minute: 30 }
);

export function _checkReunion(pros: PlanningPros): Diagnostic[] {
  const reunionDayIndex = 1; // index in week, mardi

  const out: Diagnostic[] = [];

  const grid = _normalizePros(pros);
  for (const semaine of pros.semaines) {
    const prosCount = semaine.prosHoraires.length; // total number of pros this week
    const reunionDay = grid[semaine.week][reunionDayIndex]; // day of the reunion in this week
    // select the reunion horaire and check
    for (const index of TimeGrid.rangeToIndexes(horairesReunion)) {
      const prosPresent = reunionDay[index];
      if (prosPresent < prosCount) {
        out.push({
          dayIndex: { week: semaine.week, day: reunionDayIndex },
          horaireIndex: index,
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

type NotEnoughSleep = {
  pro: Pro;
  expectedLendemain: Horaire;
  gotLendemain: Horaire;
};

export function _checkRepos(pros: PlanningPros): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const semaine of pros.semaines) {
    for (const pro of semaine.prosHoraires) {
      for (let iDay = 0; iDay < 4; iDay++) {
        const c = _checkReposNight(
          pro.pro,
          pro.horaires[iDay].presence,
          pro.horaires[iDay + 1].presence
        );
        if (c === undefined) continue;
        out.push({
          dayIndex: { week: semaine.week, day: iDay },
          horaireIndex: TimeGrid.horaireToIndex(
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
  pro: Pro,
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
  return { pro, expectedLendemain: lendemain, gotLendemain: following.debut };
}
