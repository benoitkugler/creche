import {
  buildProsCountDay,
  byPosition,
  checkEnfantsCountDay,
  checkPausesDay,
  ChildrenCount,
  expectedArrivals,
  largeDay,
  mediumDay,
  normalizeChildren,
  TimeGrid,
  type Arr4,
  type Arrivals,
  type RoulementsN,
} from "./check";
import { type PlanningChildren } from "./children";
import {
  emptyHoraireTravail,
  formatHoraireTravail,
  type Detachement,
  type HoraireTravail,
  type PlanningPros,
  type PlanningProsSemaine,
  type Pro,
  type Reunion,
  type SemainePro,
} from "./pros";
import type { PositionR, Roulements, SemaineRoulement } from "./roulement";
import {
  arrayEquals,
  computeDate,
  isError,
  newError,
  Range,
  type error,
  type Horaire,
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
  for (let weekI = 0; weekI < childrenN.length; weekI++) {
    const weekChildren = childrenN[weekI];

    const roulementI = (firstWeekRoulement + weekI) % R;
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
      console.log(weekI, dayI);

      const dayCandidates = _selectDayHoraires(weekChildren[dayI]);
      if (!dayCandidates.length) {
        const date = computeDate(children.firstMonday, {
          week: weekI,
          day: dayI,
        });
        return newError(
          `Aucun planning ne convient le ${date.toLocaleDateString("fr")}`
        );
      }
      //   const l = scaffoldDay(weekChildren[dayI], weekRoulement[dayI]);
      //   l.forEach(
      //     (horaire, proI) => (prosHoraires[proI].horaires[dayI] = horaire)
      //   );
    }

    weeks.push({ week: weekI, roulement: roulementI, prosHoraires });
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

function pauseDuration(dayDuration: TimeGrid.Index) {
  if (dayDuration >= largeDay) {
    return 60;
  } else if (dayDuration == mediumDay) {
    return 45;
  }
  return 30;
}

// heuristics for pauses :
// for ouverture, pause is at 10h, 10h30 or 11h
const pausesStart1: Horaire[] = [
  { heure: 10, minute: 0 },
  { heure: 10, minute: 30 },
  { heure: 11, minute: 0 },
];
// for matin, pause is either 10h30-11h, 11h-11h30 or at 13h
const pausesStart2: Horaire[] = [
  { heure: 10, minute: 30 },
  { heure: 11, minute: 0 },
  { heure: 13, minute: 0 },
];
// for soir, pause is between 13h30 and 14h30
const pausesStart3: Horaire[] = [
  { heure: 13, minute: 30 },
  { heure: 13, minute: 45 },
  { heure: 14, minute: 0 },
  { heure: 14, minute: 15 },
  { heure: 14, minute: 30 },
];

// for fermeture, pause is at 15h or 15h30
const pausesStart4: Horaire[] = [
  { heure: 15, minute: 0 },
  { heure: 15, minute: 30 },
];

const pausesCombinationCount =
  pausesStart1.length *
  pausesStart2.length *
  pausesStart3.length *
  pausesStart4.length;

// dayDurations are expressed in grid index, and in "rotation order"
// the returned slices are in "rotation order"
function generateHorairesFromDurations(
  arrivals: Arrivals,
  dayDurations: Arr4<TimeGrid.Index>,
  out: Arr4<HoraireTravail>[]
) {
  // TODO: handle less than 4 children

  // for each pro, there is 3 horaires to choose ;
  // - the "other" end of the day : defined by dayDurations
  // - the pause duration : defined by the day duration
  //    - 8h30 -> 1h
  //    - 8h15 -> 45min
  //    - 8h or less -> 30min
  // - the pause start

  const ouverture = TimeGrid.indexToHoraire(arrivals.firstArrival);
  const matin = TimeGrid.indexToHoraire(arrivals.secondArrival);
  const soir = TimeGrid.indexToHoraire(arrivals.beforeLastGo + 1); // arrivals is the last presence
  const fermeture = TimeGrid.indexToHoraire(arrivals.lastGo + 1); // arrivals is the last presence

  const pauseDuration1 = pauseDuration(dayDurations[0]);
  const pauseDuration2 = pauseDuration(dayDurations[1]);
  const pauseDuration3 = pauseDuration(dayDurations[2]);
  const pauseDuration4 = pauseDuration(dayDurations[3]);

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
    arrivals.beforeLastGo + 1 - dayDurations[2]
  );
  const presence3 = new Range(debut3, soir);

  // fermeture
  const debut4 = TimeGrid.indexToHoraire(arrivals.lastGo + 1 - dayDurations[3]);
  const presence4 = new Range(debut4, fermeture);

  let i = 0;
  for (const pause1 of pausesStart1) {
    for (const pause2 of pausesStart2) {
      for (const pause3 of pausesStart3) {
        for (const pause4 of pausesStart4) {
          out[i] = [
            {
              presence: presence1,
              pause: Range.fromDuration(pause1, pauseDuration1),
            },
            {
              presence: presence2,
              pause: Range.fromDuration(pause2, pauseDuration2),
            },
            {
              presence: presence3,
              pause: Range.fromDuration(pause3, pauseDuration3),
            },
            {
              presence: presence4,
              pause: Range.fromDuration(pause4, pauseDuration4),
            },
          ];
          i++;
        }
      }
    }
  }

  return out;
}

function allDurations(min: TimeGrid.Index, max: TimeGrid.Index) {
  const out: Arr4<TimeGrid.Index>[] = [];
  for (let d1 = min; d1 <= max; d1 += 3) {
    for (let d2 = min; d2 <= max; d2 += 3) {
      for (let d3 = min; d3 <= max; d3 += 3) {
        for (let d4 = min; d4 <= max; d4 += 3) {
          out.push([d1, d2, d3, d4]);
        }
      }
    }
  }

  // try overall less work first
  out.sort((a, b) => a[0] + a[1] + a[2] + a[3] - (b[0] + b[1] + b[2] + b[3]));

  console.log("Trying", out.length, "configs.");

  return out;
}

export function _selectDayHoraires(children: ChildrenCount[]) {
  // TODO: maybe support
  const detachements: Arr4<Detachement | undefined> = [
    undefined,
    undefined,
    undefined,
    undefined,
  ];
  const reunionRange = undefined;

  const arrivals = expectedArrivals(children);

  // start with "maximal" durations
  const maxDuration: TimeGrid.Index = 10 * 12 + 6; // 10h30
  const thresholdDuration: TimeGrid.Index = 8 * 12; // 8h
  const minDuration: TimeGrid.Index = 4 * 12; // 4h

  // For each pro, we have the follwing ranges :
  //    - under [mediumDay] or over [largeDay] : reducing duration only makes things worse
  //    - in between : it may be helpful to reduce work to also reduce pauses

  let selectedDurations: Arr4<number> | undefined;
  let selectedHoraires: Arr4<HoraireTravail>[] = [];

  // we first brute-force search between 8h and 9h,
  // less work first
  const buffer: Arr4<HoraireTravail>[] = Array.from({
    length: pausesCombinationCount,
  });
  for (const durations of allDurations(thresholdDuration, maxDuration)) {
    const validHoraires = computeValidHoraires(
      children,
      arrivals,
      detachements,
      reunionRange,
      durations,
      buffer
    );
    if (validHoraires.length) {
      // we have found a first (list of) solution
      // save it, but try with the "under thresholdDuration" durations
      selectedDurations = durations;
      selectedHoraires = validHoraires;
      break;
    }
  }

  console.log("Done");

  if (selectedDurations === undefined) return []; // aie aie aie

  // now try to reduce work for duration under thresholdDuration
  // (other has been tried)
  const prosToReduce = selectedDurations
    .map((_, i) => i)
    .filter((i) => selectedDurations[i] == thresholdDuration);
  if (!prosToReduce.length) return selectedHoraires; // can't do better

  let proCursor = 0;
  while (selectedDurations.every((v) => v >= minDuration)) {
    const validHoraires = computeValidHoraires(
      children,
      arrivals,
      detachements,
      reunionRange,
      selectedDurations,
      buffer
    );

    if (validHoraires.length) {
      selectedHoraires = validHoraires;
      // If we succeed, try with less work
      const indexToReduce = prosToReduce[proCursor % prosToReduce.length];
      selectedDurations[indexToReduce] -= 3;
      proCursor++;
    } else {
      break;
    }
  }

  return selectedHoraires;
}

export function computeValidHoraires(
  children: ChildrenCount[],
  arrivals: Arrivals,
  detachements: Arr4<Detachement | undefined>,
  reunionRange: Range | undefined,
  durations: Arr4<TimeGrid.Index>,
  buffer: Arr4<HoraireTravail>[]
) {
  // try every pauses ...
  const candidates = generateHorairesFromDurations(arrivals, durations, buffer);

  // ... and check if we have (at least) a solution that satisifies every "day by day" checks
  const validHoraires = candidates.filter((candidate) => {
    const pros = buildProsCountDay(candidate, detachements);
    const checkChildrenCount = checkEnfantsCountDay(
      children,
      pros,
      reunionRange
    );

    const ok1 = checkChildrenCount === undefined;
    const checkPauses = candidate.map((proHoraire) =>
      checkPausesDay(
        { week: 0, day: 0 },
        { prenom: "", isInterimaire: false, color: "" },
        proHoraire
      )
    );
    const ok2 = checkPauses.every((l) => !l.length);

    return ok1 && ok2;
  });

  return validHoraires;
}
