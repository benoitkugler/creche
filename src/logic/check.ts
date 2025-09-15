import { Enfants, type ContraintesEnfants } from "./enfants";
import type { PlanningPros } from "./personnel";
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

type Diagnostic = string; // TODO

/** `check` analyze les données fournies et s'assure qu'il y a
 * suffisament de pros à tout moment de la journée.
 *
 * La liste renvoyée est vide si et seulement si aucun problème n'est détecté.
 */
export function check(
  enfants: ContraintesEnfants,
  pros: PlanningPros
): Diagnostic[] {
  return [];
}

// to simplify checks we normalize the creneaux to a regular 5-min spaced
// slice

function horaireToIndex(h: Horaire) {
  return (h.heure - HeureMin) * 12 + h.minute / 5;
}

function indexToHoraire(index: number): Horaire {
  const heure = index / 12;
  const minute = index % 12;
  return { heure: (HeureMin + heure) as Heure, minute: (minute * 5) as Minute };
}

type PresenceEnfants = {
  marcheurCount: number;
  nonMarcheurCount: number;
  adaptionCount: number;
};

function zeroPresence(): PresenceEnfants {
  return {
    marcheurCount: 0,
    nonMarcheurCount: 0,
    adaptionCount: 0
  };
}

type PresenceEnfantsDay = PresenceEnfants[];

function emptyDay() {
  return Array.from({ length: 12 * (HeureMax - HeureMin) }, () =>
    zeroPresence()
  );
}

function normalizeEnfants(input: ContraintesEnfants) {
  const out = Array.from(
    { length: Enfants.semaineCount(input) },
    () =>
      [emptyDay(), emptyDay(), emptyDay(), emptyDay(), emptyDay()] as SemaineOf<
        PresenceEnfants[]
      >
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
          } else if (enfant.enfant.marcheur) {
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
