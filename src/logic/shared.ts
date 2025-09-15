export type int = number & { __opaque__: "int" };

export type Horaire = {
  heure: int;
  minute: int;
};

export type Intervalle = {
  debut: Horaire;
  fin: Horaire;
};
