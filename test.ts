export type ChildrenPlanning = {
	children: ChildCreneaux[];
	weekCount: number;
}

export type ChildCreneaux = {
	child: Child;
	creneaux: [(ChildDay | null), (ChildDay | null), (ChildDay | null), (ChildDay | null), (ChildDay | null), ][];
}

export type Child = {
	nom: string;
	dateNaissance: string;
	isMarcheur: bool;
}

export type ChildDay = {
	horaires: Range;
	isAdaptation: bool;
}

export type Range = {
	start: Horaire;
	end: Horaire;
}

export type Horaire = {
	heure: number;
	minute: number;
}

export type Horaire = {
	heure: number;
	minute: number;
}

