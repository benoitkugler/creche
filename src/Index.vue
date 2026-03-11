<template>
  <v-container fluid>
    <ViewChildren
      v-if="step == 'view-children'"
      :planning="childrenPlanning"
      :lastSave="lastSaveChildren"
      @go-next="step = 'view-pros'"
      @update="
        (p) => {
          childrenPlanning = p;
          save('children');
        }
      "
      @load="
        (p) => {
          childrenPlanning = p;
          prosPlanning = null;
          roulements = null;
          save('children');
        }
      "
    ></ViewChildren>
    <ViewPros
      v-else-if="childrenPlanning && step == 'view-pros'"
      :planning-children="childrenPlanning"
      :planning-pros="prosPlanning"
      :roulements="roulements"
      :lastSave="lastSavePros"
      @update="
        (p, r) => {
          prosPlanning = p;
          roulements = r;
          save('pros');
        }
      "
      @edit-horaires="editHorairesPros"
      @edit-misc="editMiscPros"
      @go-back="step = 'view-children'"
    ></ViewPros>

    <v-snackbar
      :model-value="successMessage != null"
      :timeout="3000"
      color="green"
    >
      {{ successMessage }}
    </v-snackbar>
  </v-container>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";

import { fromJson, type int } from "./logic/shared";
import type {
  ChildrenPlanning,
  DayIndex,
  Detachement,
  HoraireTravail,
  ProsPlanning,
  Reunion,
  Roulements,
} from "./logic/types";
import ViewChildren from "./components/ViewChildren.vue";
import ViewPros from "./components/ViewPros.vue";

onMounted(load);

const step = ref<"view-children" | "view-pros">("view-children");

const childrenPlanning = ref<ChildrenPlanning | null>(null);

const prosPlanning = ref<ProsPlanning | null>(null);

const roulements = ref<Roulements | null>(null);

const lastSaveChildren = ref<Date>(new Date());
const lastSavePros = ref<Date>(new Date());

const successMessage = ref<string | null>(null);

type localSave = {
  version: number;
  lastSaveChildren: Date;
  lastSavePros: Date;
  childrenPlanning: ChildrenPlanning;
  prosPlanning: ProsPlanning;
  roulements: Roulements | null;
};

const currentVersion = 2;

function save(data: "pros" | "children") {
  if (data == "children") {
    lastSaveChildren.value = new Date(Date.now());
  } else {
    lastSavePros.value = new Date(Date.now());
  }
  window.localStorage.setItem(
    "local-save",
    JSON.stringify({
      version: currentVersion,
      lastSaveChildren: lastSaveChildren.value,
      lastSavePros: lastSavePros.value,
      childrenPlanning: childrenPlanning.value,
      prosPlanning: prosPlanning.value,
      roulements: roulements.value,
    })
  );
}

function load() {
  const json = window.localStorage.getItem("local-save");
  if (!json) return;

  const localSave: localSave = fromJson(json);
  // avoid errors due to internal format change
  if (localSave.version != currentVersion) return;

  lastSaveChildren.value = localSave.lastSaveChildren || new Date(Date.now()); // may be undefined
  lastSavePros.value = localSave.lastSavePros || new Date(Date.now()); // may be undefined
  childrenPlanning.value = localSave.childrenPlanning;
  prosPlanning.value = localSave.prosPlanning;
  roulements.value = localSave.roulements;
  step.value = "view-children";
}

function editHorairesPros(day: DayIndex, horaires: HoraireTravail[]) {
  if (!prosPlanning.value) return;
  const l = prosPlanning.value.weeks[day.week].prosHoraires;
  if (l.length != horaires.length) return; // should not happen
  horaires.forEach((v, i) => (l[i].horaires[day.day] = v));
  successMessage.value = "Horaires modifiés avec succès.";
  save("pros");
}

function editMiscPros(
  week: int,
  reunion: Reunion | null,
  detachements: (Detachement | null)[]
) {
  if (!prosPlanning.value) return;
  const weekPro = prosPlanning.value.weeks[week];

  const l = weekPro.prosHoraires;
  if (l.length != detachements.length) return; // should not happen

  weekPro.reunion = reunion;
  detachements.forEach((v, i) => (l[i].detachement = v));
  successMessage.value = "Créneaux modifiés avec succès.";
  save("pros");
}
</script>
