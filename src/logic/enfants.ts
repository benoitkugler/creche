import type { Range, SemaineOf } from "./shared";

export type Enfant = {
  nom: string;
  dateNaissance: Date;
  isMarcheur: boolean;
};

type CreneauEnfant = Range & { isAdaptation: boolean };

type CreneauxEnfant = SemaineOf<CreneauEnfant | null>[];

export type PlanningEnfants = {
  firstMonday: Date; // lien avec le calendrier réel
  enfants: { enfant: Enfant; creneaux: CreneauxEnfant }[];
};

export namespace Enfants {
  /** returns the maximum semaine */
  export function semaineCount(input: PlanningEnfants) {
    return Math.max(...input.enfants.map(e => e.creneaux.length));
  }
}
