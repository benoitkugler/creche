import { expect, test } from "bun:test";
import {
  _checkAdaptationHoraires,
  _checkEnfantsCount,
  _checkPauses,
  _checkProsArrivals,
  _checkRepos,
  _checkReunion,
  _normalizeChildren,
  _normalizePros,
  check,
  CheckKind,
  ChildrenCount,
  TimeGrid,
} from "./check";
import { Children, type Enfant, type TextBlock } from "./enfants";
import {
  computeDate,
  HeureMax,
  HeureMin,
  isError,
  Range,
  type Heure,
  type Horaire,
  type int,
  type Minute,
} from "./shared";
import { Pros, type PlanningPros, type Pro } from "./personnel";

const enfantMarcheur: Enfant = {
  nom: "Benoit",
  dateNaissance: new Date(),
  isMarcheur: true,
};
const enfantNonMarcheur: Enfant = {
  nom: "Benoit",
  dateNaissance: new Date(),
  isMarcheur: false,
};

function pr(prenom: string) {
  return { prenom, color: "#FFFFFF", isInterimaire: false };
}

const pro: Pro = {
  prenom: "Audrey",
  color: "#FFFFFF",
  isInterimaire: false,
};

function h(h: Heure, m: Minute) {
  return { heure: h, minute: m };
}

function r(debut: Horaire, fin: Horaire) {
  return new Range(debut, fin);
}

test("date", () => {
  expect(
    computeDate(
      new Date(2025, 8, 1),
      { week: 0, day: 0 },
      h(6, 25)
    ).toISOString()
  ).toBe("2025-09-01T06:25:00.000Z");
  expect(
    computeDate(
      new Date(2025, 8, 1),
      { week: 0, day: 1 },
      h(6, 0)
    ).toISOString()
  ).toBe("2025-09-02T06:00:00.000Z");
  expect(
    computeDate(
      new Date(2025, 8, 1),
      { week: 1, day: 1 },
      h(6, 0)
    ).toISOString()
  ).toBe("2025-09-09T06:00:00.000Z");
});

test("range duration", () => {
  expect(r(h(6, 0), h(6, 45)).duration()).toBe(45);
  expect(r(h(6, 0), h(7, 0)).duration()).toBe(60);
  expect(r(h(6, 15), h(7, 0)).duration()).toBe(45);
  expect(r(h(6, 15), h(7, 5)).duration()).toBe(50);
  expect(r(h(6, 0), h(8, 0)).duration()).toBe(120);
  expect(r(h(7, 0), h(7, 0)).duration()).toBe(0);
});

test("range overlaps", () => {
  expect(r(h(6, 0), h(6, 45)).overlaps(r(h(6, 0), h(6, 45)))).toBeTrue();
  expect(r(h(6, 0), h(7, 0)).overlaps(r(h(6, 0), h(7, 30)))).toBeTrue();
  expect(r(h(6, 15), h(7, 0)).overlaps(r(h(6, 15), h(6, 30)))).toBeTrue();
  expect(r(h(6, 15), h(7, 5)).overlaps(r(h(6, 0), h(6, 30)))).toBeTrue();
  expect(r(h(6, 15), h(7, 5)).overlaps(r(h(6, 0), h(6, 15)))).toBeFalse();
  expect(r(h(6, 15), h(7, 5)).overlaps(r(h(7, 5), h(7, 15)))).toBeFalse();
});

test("normalize enfants", () => {
  const grid = _normalizeChildren({
    firstMonday: new Date(),
    enfants: [
      {
        enfant: enfantMarcheur,
        creneaux: [
          [
            null,
            { horaires: new Range(h(6, 10), h(6, 30)), isAdaptation: true },
            { horaires: new Range(h(6, 10), h(6, 30)), isAdaptation: false },
            null,
            null,
          ],
        ],
      },
      {
        enfant: enfantMarcheur,
        creneaux: [
          [
            null,
            { horaires: new Range(h(6, 10), h(6, 30)), isAdaptation: false },
            { horaires: new Range(h(6, 10), h(6, 30)), isAdaptation: false },
            null,
            null,
          ],
        ],
      },
      {
        enfant: enfantNonMarcheur,
        creneaux: [
          [
            null,
            { horaires: new Range(h(6, 10), h(6, 30)), isAdaptation: false },
            { horaires: new Range(h(6, 10), h(6, 40)), isAdaptation: false },
            null,
            null,
          ],
        ],
      },
    ],
  });
  expect(grid[0][0].length).toBe(12 * (HeureMax - HeureMin));
  grid[0][0].forEach((v) => expect(v).toEqual(ChildrenCount.zero()));
  const day = grid[0][1];
  expect(day[0]).toEqual(ChildrenCount.zero());
  expect(day[1]).toEqual(ChildrenCount.zero());
  expect(day[2]).toEqual(new ChildrenCount(1, 1, 1));
  expect(grid[0][2][2]).toEqual(new ChildrenCount(2, 1, 0));
  expect(grid[0][2][6]).toEqual(new ChildrenCount(0, 1, 0));
});

test("normalize pros", () => {
  const grid = _normalizePros({
    firstMonday: new Date(),
    semaines: [
      {
        week: 1,
        prosHoraires: [
          {
            pro,
            horaires: [
              {
                presence: new Range(h(6, 0), h(12, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(12, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(12, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(12, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(12, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
            ],
            detachement: {
              dayIndex: 4,
              horaires: new Range(h(11, 0), h(11, 15)),
            },
          },
          {
            pro,
            horaires: [
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
            ],
          },
          {
            pro: { prenom: "", color: "", isInterimaire: true },
            horaires: [
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: new Range(h(6, 0), h(18, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
            ],
          },
        ],
      },
    ],
  });

  expect(grid[0][0].length).toBe(12 * (HeureMax - HeureMin));
  const monday = grid[1][0];
  expect(monday[0]).toBe(2);
  expect(monday[TimeGrid.horaireToIndex(h(10, 30))]).toBe(0);
  expect(monday[TimeGrid.horaireToIndex(h(13, 30))]).toBe(1);
  expect(monday[TimeGrid.horaireToIndex(h(18, 0))]).toBe(0);
  const friday = grid[1][4]; // détachement
  expect(friday[TimeGrid.horaireToIndex(h(11, 0))]).toBe(1);
  expect(friday[TimeGrid.horaireToIndex(h(11, 15))]).toBe(2);
});

function ec(adaptionCount: int, marcheurCount: int, nonMarcheurCount: int) {
  return new ChildrenCount(marcheurCount, nonMarcheurCount, adaptionCount);
}

test("check enfants count", () => {
  expect(_checkEnfantsCount(ec(0, 0, 0), 0)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 0, 0), 1)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 0, 0), 3)).toBeUndefined();

  expect(_checkEnfantsCount(ec(0, 2, 1), 1)).toBeUndefined();
  expect(_checkEnfantsCount(ec(0, 4, 0), 1)?.kind).toBe(
    CheckKind.MissingProForEnfants
  );
  expect(_checkEnfantsCount(ec(0, 2, 2), 1)?.kind).toBe(
    CheckKind.MissingProForEnfants
  );

  expect(_checkEnfantsCount(ec(2, 0, 0), 1)?.kind).toBe(
    CheckKind.MissingProAdaption
  );
  expect(_checkEnfantsCount(ec(1, 3, 0), 3)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 16, 0), 3)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 17, 0), 3)?.kind).toBe(
    CheckKind.MissingProForEnfants
  );
  expect(_checkEnfantsCount(ec(1, 0, 6), 3)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 0, 7), 3)?.kind).toBe(
    CheckKind.MissingProForEnfants
  );
  expect(_checkEnfantsCount(ec(1, 2, 4), 3)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 3, 4), 3)?.kind).toBe(
    CheckKind.MissingProForEnfants
  );
});

test("check reunion1", () => {
  const planning: PlanningPros = {
    firstMonday: new Date(2025, 8, 1),
    semaines: [
      {
        week: 0,
        prosHoraires: [
          {
            pro,
            horaires: [
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: new Range(h(6, 0), h(16, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
            ],
          },
          {
            pro,
            horaires: [
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: new Range(h(6, 0), h(16, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
            ],
          },
        ],
      },
      {
        week: 1,
        reunion: { day: 1, horaire: h(13, 30) },
        prosHoraires: [
          {
            pro: pr("pro1"),
            horaires: [
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: new Range(h(6, 0), h(16, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
            ],
          },
          {
            pro: pr("pro2"),
            horaires: [
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: new Range(h(6, 0), h(16, 0)),
                pause: new Range(h(10, 30), h(14, 0)),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
            ],
          },
        ],
      },

      {
        week: 2,
        prosHoraires: [
          {
            pro,
            horaires: [
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: new Range(h(6, 0), h(16, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
            ],
          },
          {
            pro,
            horaires: [
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: new Range(h(6, 0), h(16, 0)),
                pause: new Range(h(10, 30), h(14, 0)),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
            ],
          },
        ],
      },
    ],
  };

  const diag = _checkReunion(planning);
  expect(diag).toHaveLength(1);
  expect(diag[0].check.kind).toBe(CheckKind.MissingProAtReunion);
  if (diag[0].check.kind != CheckKind.MissingProAtReunion) return;
  expect(diag[0].dayIndex).toEqual({ week: 1, day: 1 });
  expect(diag[0].check.missing.prenom).toBe("pro2");
  expect(diag[0].horaireIndex).toBe(TimeGrid.horaireToIndex(h(13, 30)));
});

test("check repos", () => {
  const planning: PlanningPros = {
    firstMonday: new Date(2025, 8, 1),
    semaines: [
      {
        week: 1,
        prosHoraires: [
          {
            pro,
            horaires: [
              {
                presence: new Range(h(6, 0), h(20, 15)),
                pause: Range.empty(),
              },
              {
                presence: new Range(h(7, 0), h(16, 0)),
                pause: new Range(h(10, 30), h(11, 0)),
              },
              {
                presence: Range.empty(),
                pause: Range.empty(),
              },
              {
                presence: new Range(h(6, 0), h(20, 0)),
                pause: Range.empty(),
              },
              {
                presence: new Range(h(7, 0), h(16, 0)), // just enough !
                pause: Range.empty(),
              },
            ],
          },
        ],
      },
    ],
  };
  const diags = _checkRepos(planning);
  expect(diags).toHaveLength(1);
  expect(diags[0].check.kind).toBe(CheckKind.NotEnoughSleep);
  if (diags[0].check.kind != CheckKind.NotEnoughSleep) return;
  expect(diags[0].check.expectedLendemain).toEqual(h(7, 15));
});

test("check pro arrivals", () => {
  const enfants2 = [
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 1, 0),
    ec(0, 1, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
  ];
  expect(
    _checkProsArrivals(enfants2, [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0])
  ).toHaveLength(0);
  expect(
    _checkProsArrivals(enfants2, [0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0])
  ).toHaveLength(0);
  expect(
    _checkProsArrivals(enfants2, [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0])
  ).toHaveLength(1);
  expect(
    _checkProsArrivals(enfants2, [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0])
  ).toHaveLength(1);
  expect(
    _checkProsArrivals(enfants2, [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0])
  ).toHaveLength(2);

  // with more than 3
  const enfants5 = [
    ec(0, 0, 0), // 0
    ec(0, 0, 0), // 1
    ec(0, 0, 0), // 2
    ec(0, 0, 0), // 3
    ec(0, 1, 0), // 4
    ec(0, 2, 1), // 5
    ec(0, 2, 1), // 6
    ec(0, 2, 3), // 7
    ec(0, 0, 0), // 8
    ec(0, 0, 0), // 9
    ec(0, 0, 0), // 10
    ec(0, 0, 0), // 11
    ec(0, 0, 0), // 12
    ec(0, 0, 0), // 13
    ec(0, 0, 0), // 14
    ec(0, 0, 0), // 15
  ];
  expect(
    _checkProsArrivals(
      enfants5,
      [0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0]
    )
  ).toHaveLength(0);
  expect(
    _checkProsArrivals(
      enfants5,
      [0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0]
    )
  ).toHaveLength(1);
  expect(
    _checkProsArrivals(
      enfants5,
      [0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0]
    )
  ).toHaveLength(2);
  expect(
    _checkProsArrivals(
      enfants5,
      [0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 0]
    )
  ).toHaveLength(3);
  expect(
    _checkProsArrivals(
      enfants5,
      [0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0]
    )
  ).toHaveLength(3);
  expect(
    _checkProsArrivals(
      enfants5,
      [0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0]
    )
  ).toHaveLength(4);
  const diags = _checkProsArrivals(
    enfants5,
    [0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0]
  );
  expect(diags).toHaveLength(4);
  // check the depart horaire is correct
  const [first, last, second, secondLast] = diags;
  expect(first.moment).toBe("first-arrival");
  expect(last.moment).toBe("last-go");
  expect(second.moment).toBe("second-arrival");
  expect(secondLast.moment).toBe("before-last-go");

  expect(first.expected).toEqual(TimeGrid.indexToHoraire(1));
  expect(first.got).toEqual(TimeGrid.indexToHoraire(2));

  expect(second.expected).toEqual(TimeGrid.indexToHoraire(4));
  expect(second.got).toEqual(TimeGrid.indexToHoraire(5));

  expect(last.expected).toEqual(TimeGrid.indexToHoraire(14));
  expect(last.got).toEqual(TimeGrid.indexToHoraire(15));

  expect(secondLast.expected).toEqual(TimeGrid.indexToHoraire(11));
  expect(secondLast.got).toEqual(TimeGrid.indexToHoraire(12));
});

test("check adaptations horaires", () => {
  expect(_checkAdaptationHoraires(r(h(6, 0), h(7, 0)))).not.toBeUndefined();
  expect(_checkAdaptationHoraires(r(h(10, 0), h(10, 30)))).toBeUndefined();
  expect(_checkAdaptationHoraires(r(h(9, 45), h(11, 45)))).not.toBeUndefined();
});

test("check pauses", () => {
  const dayIndex = { week: 0, day: 0 };
  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(6, 0), h(7, 0)),
      pause: Range.empty(),
    })
  ).toHaveLength(0);
  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(6, 0), h(11, 45)),
      pause: Range.empty(),
    })
  ).toHaveLength(0);
  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(6, 0), h(12, 0)),
      pause: Range.empty(),
    })
  ).toHaveLength(1);
  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(11, 0), h(14, 0)),
      pause: Range.empty(),
    })
  ).toHaveLength(1);
  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(13, 0), h(14, 0)),
      pause: Range.empty(),
    })
  ).toHaveLength(0);

  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(11, 0), h(14, 0)),
      pause: r(h(13, 30), h(14, 0)),
    })
  ).toHaveLength(0);
  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(11, 0), h(14, 0)),
      pause: r(h(12, 50), h(14, 0)),
    })
  ).toHaveLength(1);
  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(11, 0), h(14, 0)),
      pause: r(h(13, 0), h(13, 10)),
    })
  ).toHaveLength(1);
  // large pause
  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(8, 0), h(18, 0)),
      pause: r(h(13, 0), h(14, 0)),
    })
  ).toHaveLength(0);
  expect(
    _checkPauses(dayIndex, pro, {
      presence: r(h(8, 0), h(18, 0)),
      pause: r(h(13, 0), h(13, 45)),
    })
  ).toHaveLength(1);

  //   interim
  const interim = { prenom: "", color: "", isInterimaire: true };
  expect(
    _checkPauses(dayIndex, interim, {
      presence: r(h(10, 0), h(15, 0)),
      pause: r(h(12, 0), h(13, 0)),
    })
  ).toHaveLength(0);
  expect(
    _checkPauses(dayIndex, interim, {
      presence: r(h(10, 0), h(15, 0)),
      pause: r(h(13, 0), h(14, 0)),
    })
  ).toHaveLength(0);
  expect(
    _checkPauses(dayIndex, interim, {
      presence: r(h(8, 0), h(18, 0)),
      pause: r(h(13, 0), h(13, 45)),
    })
  ).toHaveLength(1);
});

test("check sample 1", async () => {
  const childrenF = Bun.file("src/logic/sample_enfants_redacted_0.json");
  const data: TextBlock[] = await childrenF.json();
  const planningChildren = Children.parsePDFEnfants(data);
  expect(isError(planningChildren)).toBeFalse();
  if (isError(planningChildren)) return;

  for (const index of [1, 2, 3, 4, 5, 6, 8, 9]) {
    planningChildren.enfants[index].enfant.isMarcheur = true;
  }

  const prosF = Bun.file("src/logic/sample_personnel_redacted_1.xlsx");
  const planningPros = await Pros.parseExcelPros(
    prosF,
    planningChildren.firstMonday
  );
  expect(isError(planningPros)).toBeFalse();
  if (isError(planningPros)) return;

  expect(check(planningChildren, planningPros)).toHaveLength(39);
});
