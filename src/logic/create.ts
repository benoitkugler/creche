import {
  byPosition,
  ChildrenCount,
  expectedArrivals,
  normalizeChildren,
  TimeGrid,
  type Arr4,
  type RoulementsN,
} from "./check";
import { type PlanningChildren } from "./enfants";
import {
  emptyHoraireTravail,
  type HoraireTravail,
  type PlanningPros,
  type PlanningProsSemaine,
  type Pro,
  type SemainePro,
} from "./personnel";
import type { PositionR, Roulements, SemaineRoulement } from "./roulement";
import {
  arrayEquals,
  isError,
  newError,
  Range,
  type error,
  type int,
  type SemaineOf,
} from "./shared";

/** `firstWeekRoulement` is the (0-based) index in `roulements` of the
 * first week defined in `children`
 */
export function createPlanningPros(
  children: PlanningChildren,
  roulements_: Roulements,
  firstWeekRoulement: int
): PlanningPros | error {
  const tmp = normalizeRoulements(roulements_);
  if (isError(tmp)) return tmp;
  const { pros, roulements } = tmp;

  const weeks: PlanningProsSemaine[] = [];

  const R = roulements.length;
  const childrenN = normalizeChildren(children);
  for (let week = 0; week < childrenN.length; week++) {
    const weekChildren = childrenN[week];

    const roulementI = (firstWeekRoulement + week) % R;
    const weekRoulement = roulements[roulementI];

    const prosHoraires = pros.map((pro) => ({
      pro,
      horaires: [
        emptyHoraireTravail(),
        emptyHoraireTravail(),
        emptyHoraireTravail(),
        emptyHoraireTravail(),
        emptyHoraireTravail(),
      ],
    })) satisfies SemainePro[];

    for (let dayI = 0; dayI < 5; dayI++) {
      const l = scaffoldDay(weekChildren[dayI], weekRoulement[dayI]);
      l.forEach(
        (horaire, proI) => (prosHoraires[proI].horaires[dayI] = horaire)
      );
    }

    weeks.push({ week, roulement: roulementI, prosHoraires });
  }

  return { firstMonday: children.firstMonday, weeks: weeks };
}

// applique une logique de base en utilisant
// les règles d'arrivée et départ liées au enfants
// les pauses sont encore à déterminer
function scaffoldDay(
  children: ChildrenCount[],
  roulementsPros: Arr4<PositionR>
): Arr4<HoraireTravail> {
  const arrivals = expectedArrivals(children);
  if (arrivals.firstArrival == -1) {
    return [
      emptyHoraireTravail(),
      emptyHoraireTravail(),
      emptyHoraireTravail(),
      emptyHoraireTravail(),
    ];
  }

  if (arrivals.secondArrival == -1) {
    throw "not supported";
  }

  // ouverture
  const ouverture = TimeGrid.indexToHoraire(arrivals.firstArrival);
  const fin1 = TimeGrid.indexToHoraire(arrivals.firstArrival + 7 * 12); // 7h later
  const h1: HoraireTravail = {
    presence: new Range(ouverture, fin1),
    pause: Range.empty(),
  };

  // matin
  const matin = TimeGrid.indexToHoraire(arrivals.secondArrival);
  const fin2 = TimeGrid.indexToHoraire(arrivals.secondArrival + 7 * 12); // 7h later
  const h2: HoraireTravail = {
    presence: new Range(matin, fin2),
    pause: Range.empty(),
  };

  // soir
  const soir = TimeGrid.indexToHoraire(arrivals.beforeLastGo);
  const debut3 = TimeGrid.indexToHoraire(arrivals.beforeLastGo - 7 * 12); // 7h before
  const h3: HoraireTravail = {
    presence: new Range(debut3, soir),
    pause: Range.empty(),
  };

  // fermeture
  const fermeture = TimeGrid.indexToHoraire(arrivals.lastGo);
  const debut4 = TimeGrid.indexToHoraire(arrivals.lastGo - 7 * 12); // 7h before
  const h4: HoraireTravail = {
    presence: new Range(debut4, fermeture),
    pause: Range.empty(),
  };

  return byPosition([h1, h2, h3, h4], roulementsPros);
}

// check we follow these simplifying rules :
//  - 4 pros, always in the same order
//  - exactly one Position per pro per day
export function normalizeRoulements(
  roulements: Roulements
): { pros: Arr4<Pro>; roulements: RoulementsN } | error {
  if (!roulements.length) return newError("Roulements manquants.");

  const pros = prosFromRoulement(roulements[0]);

  const out: SemaineOf<Arr4<PositionR>>[] = [];
  for (const prosR of roulements) {
    if (prosR.length != 4) {
      return newError(`Semaine de roulements à ${prosR.length} pro(s).`);
    }

    // check name are consistent
    if (
      !arrayEquals(
        prosFromRoulement(prosR).map((p) => p.prenom),
        pros.map((p) => p.prenom)
      )
    ) {
      return newError("Ordre des pros. inconsistent.");
    }

    const day0 = checkDay(prosR, 0);
    if (isError(day0)) return day0;
    const day1 = checkDay(prosR, 1);
    if (isError(day1)) return day1;
    const day2 = checkDay(prosR, 2);
    if (isError(day2)) return day2;
    const day3 = checkDay(prosR, 3);
    if (isError(day3)) return day3;
    const day4 = checkDay(prosR, 4);
    if (isError(day4)) return day4;

    out.push([day0, day1, day2, day3, day4]);
  }
  return { pros: pros as Arr4<Pro>, roulements: out };
}

function checkDay(pros: SemaineRoulement, dayI: int): Arr4<PositionR> | error {
  const dayPositions = [
    pros[0].positions[dayI],
    pros[1].positions[dayI],
    pros[2].positions[dayI],
    pros[3].positions[dayI],
  ] satisfies Arr4<PositionR>;
  if (new Set(dayPositions).size != 4) {
    return newError(`Roulement invalide (journée ${dayPositions}).`);
  }
  return dayPositions;
}

function prosFromRoulement(pros: SemaineRoulement): Pro[] {
  return pros.map((pro) => ({
    prenom: pro.prenom,
    color: pro.color,
    isInterimaire: false,
  }));
}
