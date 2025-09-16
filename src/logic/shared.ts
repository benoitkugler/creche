export type int = number;

export type Horaire = {
  heure: Heure;
  minute: Minute;
};

export type Intervalle = {
  debut: Horaire;
  fin: Horaire;
};

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

export const HeureMin = 6;
export const HeureMax = 22;

// du lundi au vendredi
export type SemaineOf<T> = [T, T, T, T, T];
