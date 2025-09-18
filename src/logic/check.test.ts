import { expect, test } from "bun:test";
import {
  _checkNombreEnfants as _checkEnfantsCount,
  _checkReunion,
  _normalizeEnfants,
  _normalizePros,
  CheckKind,
  horaireToIndex,
  zeroPresenceEnfants,
  type _EnfantsCount
} from "./check";
import type { Enfant } from "./enfants";
import {
  computeDate,
  emptyRange,
  HeureMax,
  HeureMin,
  type Heure,
  type int,
  type Minute
} from "./shared";
import type { PlanningPros, Pro } from "./personnel";

const enfantMarcheur: Enfant = {
  nom: "Benoit",
  dateNaissance: new Date(),
  isMarcheur: true
};
const enfantNonMarcheur: Enfant = {
  nom: "Benoit",
  dateNaissance: new Date(),
  isMarcheur: false
};

const pro: Pro = {
  prenom: "Audrey"
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
            { debut: h(6, 10), fin: h(6, 30), isAdaptation: true },
            { debut: h(6, 10), fin: h(6, 30), isAdaptation: false },
            null,
            null
          ]
        ]
      },
      {
        enfant: enfantMarcheur,
        creneaux: [
          [
            null,
            { debut: h(6, 10), fin: h(6, 30), isAdaptation: false },
            { debut: h(6, 10), fin: h(6, 30), isAdaptation: false },
            null,
            null
          ]
        ]
      },
      {
        enfant: enfantNonMarcheur,
        creneaux: [
          [
            null,
            { debut: h(6, 10), fin: h(6, 30), isAdaptation: false },
            { debut: h(6, 10), fin: h(6, 40), isAdaptation: false },
            null,
            null
          ]
        ]
      }
    ]
  });
  expect(grid[0][0].length).toBe(12 * (HeureMax - HeureMin));
  grid[0][0].forEach(v => expect(v).toEqual(zeroPresenceEnfants()));
  const day = grid[0][1];
  expect(day[0]).toEqual(zeroPresenceEnfants());
  expect(day[1]).toEqual(zeroPresenceEnfants());
  expect(day[2]).toEqual({
    adaptionCount: 1,
    marcheurCount: 1,
    nonMarcheurCount: 1
  });
  expect(grid[0][2][2]).toEqual({
    adaptionCount: 0,
    marcheurCount: 2,
    nonMarcheurCount: 1
  });
  expect(grid[0][2][6]).toEqual({
    adaptionCount: 0,
    marcheurCount: 0,
    nonMarcheurCount: 1
  });
});

test("normalize pros", () => {
  const grid = _normalizePros({
    firstMonday: new Date(),
    semaines: [
      {
        semaine: 1,
        prosHoraires: [
          {
            pro,
            horaires: [
              {
                presence: { debut: h(6, 0), fin: h(12, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: { debut: h(6, 0), fin: h(12, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: { debut: h(6, 0), fin: h(12, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: { debut: h(6, 0), fin: h(12, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: { debut: h(6, 0), fin: h(12, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              }
            ]
          },
          {
            pro,
            horaires: [
              {
                presence: { debut: h(6, 0), fin: h(18, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: { debut: h(6, 0), fin: h(18, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: { debut: h(6, 0), fin: h(18, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: { debut: h(6, 0), fin: h(18, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: { debut: h(6, 0), fin: h(18, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              }
            ]
          }
        ]
      }
    ]
  });

  expect(grid[0][0].length).toBe(12 * (HeureMax - HeureMin));
  const day = grid[1][0];
  expect(day[0]).toBe(2);
  expect(day[horaireToIndex(h(10, 30))]).toBe(0);
  expect(day[horaireToIndex(h(13, 30))]).toBe(1);
  expect(day[horaireToIndex(h(18, 0))]).toBe(0);
});

function ec(
  adaptionCount: int,
  marcheurCount: int,
  nonMarcheurCount: int
): _EnfantsCount {
  return { adaptionCount, marcheurCount, nonMarcheurCount };
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
  expect(computeDate(new Date(2025, 8, 1), 0, 0, h(6, 25)).toISOString()).toBe(
    "2025-09-01T06:25:00.000Z"
  );
  expect(computeDate(new Date(2025, 8, 1), 0, 1, h(6, 0)).toISOString()).toBe(
    "2025-09-02T06:00:00.000Z"
  );
  expect(computeDate(new Date(2025, 8, 1), 1, 1, h(6, 0)).toISOString()).toBe(
    "2025-09-09T06:00:00.000Z"
  );
});

test("check reunion1", () => {
  const planning: PlanningPros = {
    firstMonday: new Date(2025, 8, 1),
    semaines: [
      {
        semaine: 0,
        prosHoraires: [
          {
            pro,
            horaires: [
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: { debut: h(6, 0), fin: h(16, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              }
            ]
          },
          {
            pro,
            horaires: [
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: { debut: h(6, 0), fin: h(16, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              }
            ]
          }
        ]
      },
      {
        semaine: 1,
        prosHoraires: [
          {
            pro,
            horaires: [
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: { debut: h(6, 0), fin: h(16, 0) },
                pause: { debut: h(10, 30), fin: h(11, 0) }
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              }
            ]
          },
          {
            pro,
            horaires: [
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: { debut: h(6, 0), fin: h(16, 0) },
                pause: { debut: h(10, 30), fin: h(14, 0) }
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              },
              {
                presence: emptyRange(),
                pause: emptyRange()
              }
            ]
          }
        ]
      }
    ]
  };

  const diag = _checkReunion(planning);
  expect(diag).not.toBeUndefined();
  expect(diag!.check.kind).toBe(CheckKind.MissingProAtReunion);
  expect(diag!.check.expect).toBe(2);
  expect(diag!.check.got).toBe(1);
  expect(diag!.date.toISOString()).toBe("2025-09-09T13:30:00.000Z");
});
