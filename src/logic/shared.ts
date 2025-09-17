export type int = number;

export type Horaire = {
  heure: Heure;
  minute: Minute;
};

export type Intervalle = {
  debut: Horaire;
  fin: Horaire;
};

export function emptyIntervalle(): Intervalle {
  return { debut: { heure: 12, minute: 0 }, fin: { heure: 12, minute: 0 } };
}

export type Minute = 0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55;
export type Heure =
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21;

export const HeureMin = 6; // inclus
export const HeureMax = 22; // exclus

export function isHeure(v: int): Heure | null {
  if (HeureMin <= v && v < HeureMax) {
    return v as Heure;
  }
  return null;
}

export function isMinute(v: int): Minute | null {
  if (0 <= v && v <= 55 && v % 5 == 0) {
    return v as Minute;
  }
  return null;
}

// du lundi au vendredi
export type SemaineOf<T> = [T, T, T, T, T];

export type error = string;
