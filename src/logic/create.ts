import {
  byPosition,
  ChildrenCount,
  expectedArrivals,
  normalizeChildren,
  TimeGrid,
  type Arr4,
  type Arrivals,
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
} from "./pros";
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
      console.log(week, dayI);

      selectDayHoraires(weekChildren[dayI]);

      //   const l = scaffoldDay(weekChildren[dayI], weekRoulement[dayI]);
      //   l.forEach(
      //     (horaire, proI) => (prosHoraires[proI].horaires[dayI] = horaire)
      //   );
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

// dayDurations are expressed in grid index, and in "rotation order"
// the returned slices are in "rotation order"
function generateHorairesFromDurations(
  arrivals: Arrivals,
  dayDurations: Arr4<TimeGrid.Index>
): Arr4<HoraireTravail>[] {
  // TODO: handle less than 4 children

  // for each pro, there is 3 horaires to choose ;
  // - the "other" end of the day : defined by dayDurations
  // - the pause : start + duration (30, 45 or 60 min)

  const ouverture = TimeGrid.indexToHoraire(arrivals.firstArrival);
  const matin = TimeGrid.indexToHoraire(arrivals.secondArrival);
  const soir = TimeGrid.indexToHoraire(arrivals.beforeLastGo);
  const fermeture = TimeGrid.indexToHoraire(arrivals.lastGo);

  // ouverture
  const fin1 = TimeGrid.indexToHoraire(arrivals.firstArrival + dayDurations[0]);
  const presence1 = new Range(ouverture, fin1);

  // matin
  const fin2 = TimeGrid.indexToHoraire(
    arrivals.secondArrival + dayDurations[1]
  );
  const presence2 = new Range(matin, fin2);

  // soir
  const debut3 = TimeGrid.indexToHoraire(
    arrivals.beforeLastGo - dayDurations[2]
  );
  const presence3 = new Range(debut3, soir);

  // fermeture
  const debut4 = TimeGrid.indexToHoraire(arrivals.lastGo - dayDurations[3]);
  const presence4 = new Range(debut4, fermeture);

  // heuristics for pauses :
  // for ouverture, pause is either at 10h or 11h, for 30min
  const pauses1 = [
    Range.fromDuration({ heure: 10, minute: 0 }, 30),
    Range.fromDuration({ heure: 11, minute: 0 }, 30),
  ];
  // for matin, pause is always at 13h, for 30 or 45min
  const pauses2 = [
    Range.fromDuration({ heure: 13, minute: 0 }, 30),
    Range.fromDuration({ heure: 13, minute: 0 }, 45),
  ];
  // for soir, pause is between 13h30 and 14h30 (all duration possible)
  const pauses3: Range[] = [];
  for (const start of [
    { heure: 13, minute: 30 },
    { heure: 13, minute: 45 },
    { heure: 14, minute: 0 },
    { heure: 14, minute: 15 },
    { heure: 14, minute: 30 },
  ] as const) {
    pauses3.push(
      Range.fromDuration(start, 30),
      Range.fromDuration(start, 45),
      Range.fromDuration(start, 60)
    );
  }
  // for fermeture, pause is at 15h or 15h30, for 30min
  const pauses4 = [
    Range.fromDuration({ heure: 15, minute: 0 }, 30),
    Range.fromDuration({ heure: 15, minute: 30 }, 30),
  ];

  const out: Arr4<HoraireTravail>[] = [];
  for (const pause1 of pauses1) {
    for (const pause2 of pauses2) {
      for (const pause3 of pauses3) {
        for (const pause4 of pauses4) {
          out.push([
            { presence: presence1, pause: pause1 },
            { presence: presence2, pause: pause2 },
            { presence: presence3, pause: pause3 },
            { presence: presence4, pause: pause4 },
          ]);
        }
      }
    }
  }

  return out;
}

function selectDayHoraires(children: ChildrenCount[]) {
  const arrivals = expectedArrivals(children);

  // start with "maximal" durations
  const startDuration: TimeGrid.Index = 9 * 12 + 6; // 9h30
  const minDuration: TimeGrid.Index = 3 * 12; // 3h
  const durations: Arr4<TimeGrid.Index> = [
    startDuration,
    startDuration,
    startDuration,
    startDuration,
  ];
  // try to decrease work duration 15min by 15min
  let tryCount = 0;
  while (durations.every((v) => v >= minDuration)) {
    // try every pauses
    const candidates = generateHorairesFromDurations(arrivals, durations);

    console.log(durations, candidates.length);

    // TODO: apply every "day by day" checks

    // decrease one pro day length; in a circular fashion
    durations[tryCount % 4] -= 3;
    tryCount += 1;
  }
}
