import type { Horaire, Intervalle, SemaineOf } from "./shared";

type Enfant = {
  nom: string;
  dateNaissance: Date;
  marcheur: boolean;
};

type CreneauEnfant = Intervalle & { isAdaptation: boolean };

type CreneauxEnfant = SemaineOf<CreneauEnfant | null>[];

export type ContraintesEnfants = {
  firstMonday: Date; // lien avec le calendrier réel
  enfants: { enfant: Enfant; creneaux: CreneauxEnfant }[];
};

export namespace Enfants {
  export function semaineCount(input: ContraintesEnfants) {
    return Math.max(...input.enfants.map(e => e.creneaux.length));
  }
}
