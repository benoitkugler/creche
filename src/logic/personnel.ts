import type { int, Intervalle } from "./shared";

export type Pro = {
  prenom: string;
};

type HoraireTravail = {
  presence: Intervalle;
  pause: Intervalle;
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
  horaires: SemainePro[]; // pour chaque pro
};

export type PlanningPros = PlanningProsSemaine[];

export namespace Pros {
  /** returns the maximum semaine + 1 */
  export function semaineCount(input: PlanningPros) {
    return Math.max(...input.map(e => e.semaine)) + 1;
  }
}
