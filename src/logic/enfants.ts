import type { Horaire, Intervalle } from "./shared";

type Enfant = {
  nom: string;
  dateNaissance: Date;
  marcheur: boolean;
};

type CreneauEnfant = Intervalle & { isAdaptation: boolean };

// du lundi au vendredi
type Semaine = [
  CreneauEnfant | null,
  CreneauEnfant | null,
  CreneauEnfant | null,
  CreneauEnfant | null,
  CreneauEnfant | null
];

type CreneauxEnfant = Semaine[];

export type ContraintesEnfants = {
  firstMonday: Date; // lien avec le calendrier réel
  enfants: { enfant: Enfant; creneaux: CreneauxEnfant }[];
};
