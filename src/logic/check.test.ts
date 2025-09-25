import { expect, test } from "bun:test";
import {
  _checkEnfantsCount,
  _checkProsArrivals,
  _checkRepos,
  _checkReunion,
  _normalizeEnfants,
  _normalizePros,
  CheckKind,
  ChildrenCount,
  TimeGrid,
} from "./check";
import type { Enfant } from "./enfants";
import {
  computeDate,
  HeureMax,
  HeureMin,
  Range,
  type Heure,
  type int,
  type Minute,
} from "./shared";
import type { PlanningPros, Pro } from "./personnel";

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

const pro: Pro = {
  prenom: "Audrey",
  color: "#FFFFFF",
};

function h(h: Heure, m: Minute) {
  return { heure: h, minute: m };
}

test("normalize enfants", () => {
  const grid = _normalizeEnfants({
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
        ],
      },
    ],
  });

  expect(grid[0][0].length).toBe(12 * (HeureMax - HeureMin));
  const day = grid[1][0];
  expect(day[0]).toBe(2);
  expect(day[TimeGrid.horaireToIndex(h(10, 30))]).toBe(0);
  expect(day[TimeGrid.horaireToIndex(h(13, 30))]).toBe(1);
  expect(day[TimeGrid.horaireToIndex(h(18, 0))]).toBe(0);
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
  expect(diag).toHaveLength(2);
  expect(diag[0].check.kind).toBe(CheckKind.MissingProAtReunion);
  if (diag[0].check.kind != CheckKind.MissingProAtReunion) return;
  expect(diag[0].check.expect).toBe(2);
  expect(diag[0].check.got).toBe(1);
  expect(diag[0].dayIndex).toEqual({ week: 1, day: 1 });
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

  // with more than 5
  const enfants5 = [
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 0, 0),
    ec(0, 1, 0),
    ec(0, 2, 1),
    ec(0, 2, 1),
    ec(0, 2, 3),
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
  expect(
    _checkProsArrivals(
      enfants5,
      [0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0]
    )
  ).toHaveLength(4);
});
