import { expect, test } from "bun:test";
import {
  _checkNombreEnfants as _checkEnfantsCount,
  _normalizeEnfants,
  _normalizePros,
  DiagnosticKind,
  horaireToIndex,
  zeroPresenceEnfants,
  type _EnfantsCount
} from "./check";
import type { Enfant } from "./enfants";
import {
  HeureMax,
  HeureMin,
  type Heure,
  type int,
  type Minute
} from "./shared";
import type { Pro } from "./personnel";

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
  const grid = _normalizePros([
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
  ]);

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
  expect(_checkEnfantsCount(ec(2, 0, 0), 1)?.kind).toBe(
    DiagnosticKind.MissingProAdaption
  );
  expect(_checkEnfantsCount(ec(1, 3, 0), 3)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 16, 0), 3)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 17, 0), 3)?.kind).toBe(
    DiagnosticKind.MissingProForEnfants
  );
  expect(_checkEnfantsCount(ec(1, 0, 6), 3)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 0, 7), 3)?.kind).toBe(
    DiagnosticKind.MissingProForEnfants
  );
  expect(_checkEnfantsCount(ec(1, 2, 4), 3)).toBeUndefined();
  expect(_checkEnfantsCount(ec(1, 3, 4), 3)?.kind).toBe(
    DiagnosticKind.MissingProForEnfants
  );
});
