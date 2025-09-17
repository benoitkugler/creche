import { en } from "vuetify/locale";
import { Enfants, type PlanningEnfants } from "./enfants";
import { Pros, type PlanningPros } from "./personnel";
import {
  HeureMax,
  HeureMin,
  type Heure,
  type Horaire,
  type int,
  type Minute,
  type SemaineOf
} from "./shared";

const marcheursParPro = 8;
const nonMarcheursParPro = 3;

// TODO: que faire d'un groupe mixte avec une seule pro ?

/** `check` analyze les données fournies et s'assure qu'il y a
 * suffisament de pros à tout moment de la journée.
 *
 * La liste renvoyée est vide si et seulement si aucun problème n'est détecté.
 */
export function check(
  enfants: PlanningEnfants,
  pros: PlanningPros
): Diagnostic[] {
  return [];
}

// to simplify checks we normalize the creneaux to a regular 5-min spaced
// slice

const gridLength = 12 * (HeureMax - HeureMin);

export function horaireToIndex(h: Horaire) {
  return (h.heure - HeureMin) * 12 + h.minute / 5;
}

export function indexToHoraire(index: number): Horaire {
  const heure = index / 12;
  const minute = index % 12;
  return { heure: (HeureMin + heure) as Heure, minute: (minute * 5) as Minute };
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
    adaptionCount: 0
  };
}

function emptyDayEnfants() {
  return Array.from({ length: gridLength }, () => zeroPresenceEnfants());
}

export function _normalizeEnfants(input: PlanningEnfants): Grid<_EnfantsCount> {
  const out = Array.from(
    { length: Enfants.semaineCount(input) },
    () =>
      [
        emptyDayEnfants(),
        emptyDayEnfants(),
        emptyDayEnfants(),
        emptyDayEnfants(),
        emptyDayEnfants()
      ] as SemaineOf<_EnfantsCount[]>
  );

  for (const enfant of input.enfants) {
    enfant.creneaux.forEach((semaine, iSemaine) => {
      semaine.forEach((day, iDay) => {
        if (day === null) return;
        const currentDay = out[iSemaine][iDay];
        const indexDebut = horaireToIndex(day.debut);
        const indexFin = horaireToIndex(day.fin);
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
  return Array.from({ length: gridLength }, () => 0);
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
        emptyDayPros()
      ] as SemaineOf<int[]>
  );

  input.forEach(semaine => {
    const iSemaine = semaine.semaine;
    semaine.prosHoraires.forEach(pro => {
      pro.horaires.forEach((day, iDay) => {
        const currentDay = out[iSemaine][iDay];
        // gestion de la pause : 2 plages
        const indexDebut1 = horaireToIndex(day.presence.debut);
        const indexFin1 = horaireToIndex(day.pause.debut);
        for (let index = indexDebut1; index < indexFin1; index++) {
          currentDay[index] += 1;
        }
        const indexDebut2 = horaireToIndex(day.pause.fin);
        const indexFin2 = horaireToIndex(day.presence.fin);
        for (let index = indexDebut2; index < indexFin2; index++) {
          currentDay[index] += 1;
        }
      });
    });
  });

  return out;
}

export const DiagnosticKind = {
  MissingProAdaption: 0,
  MissingProForEnfants: 1
} as const;
export type DiagnosticKind =
  (typeof DiagnosticKind)[keyof typeof DiagnosticKind];

type Diagnostic = {
  kind: DiagnosticKind;
  data: MissingProAdaption | MissingProForEnfants;
};

type MissingProAdaption = { kind: 0; got: int; expect: int };
type MissingProForEnfants = { kind: 1; got: int; expect: int };

// TODO: check and document the rules
export function _checkNombreEnfants(enfants: _EnfantsCount, pros: int) {
  // adaption requires a full pro
  if (enfants.adaptionCount > pros) {
    return {
      kind: DiagnosticKind.MissingProAdaption,
      got: pros,
      expect: enfants.adaptionCount
    } satisfies MissingProAdaption;
  }
  pros -= enfants.adaptionCount;

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
      kind: DiagnosticKind.MissingProForEnfants,
      got: pros,
      expect: prosForNonMarcheurs + otherPros
    } satisfies MissingProForEnfants;
  }

  // all good !
  return;
}
