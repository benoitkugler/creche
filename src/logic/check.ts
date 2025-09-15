import type { ContraintesEnfants } from "./enfants";
import type { PlanningPros } from "./personnel";

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
