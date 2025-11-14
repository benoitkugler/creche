<template>
  <v-container fluid>
    <!-- <FilesLoader
      v-if="step == 'load-files'"
      @go-next="
        (c, p, r) => {
          childrenPlanning = c;
          prosPlanning = p;
          roulements = r;
          step = 'view-children';
          successMessage = 'Fichiers importés avec succès.';
          save();
        }
      "
    ></FilesLoader> -->
    <ViewChildren
      v-if="step == 'view-children'"
      :planning="childrenPlanning"
      @go-next="step = 'view-pros'"
      @update="
        (p) => {
          childrenPlanning = p;
          save();
        }
      "
      @load="
        (p) => {
          childrenPlanning = p;
          prosPlanning = null;
          roulements = null;
          save();
        }
      "
    ></ViewChildren>
    <ViewPros
      v-else-if="childrenPlanning && step == 'view-pros'"
      :planning-children="childrenPlanning"
      :planning-pros="prosPlanning"
      :roulements="roulements"
      @update="
        (p, r) => {
          prosPlanning = p;
          roulements = r;
          save();
        }
      "
      @edit-horaires="editHorairesPros"
      @edit-detachements="editDetachementsPros"
      @go-back="step = 'view-children'"
    ></ViewPros>
    <!-- <ProsCalendar
      v-else-if="step == 'view-pros'"
      :planning-children="childrenPlanning"
      :planning-pros="prosPlanning"
      :roulements="roulements"
      @edit-horaires="editHorairesPros"
      @edit-detachements="editDetachementsPros"
      @go-back="step = 'view-children'"
    ></ProsCalendar> -->

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
import ProsCalendar from "./components/ProsCalendar.vue";
import type {
  ChildrenPlanning,
  DayIndex,
  Detachement,
  HoraireTravail,
  ProsPlanning,
  Roulements,
} from "./logic/types";
import ViewChildren from "./components/ViewChildren.vue";
import ViewPros from "./components/ViewPros.vue";

onMounted(load);

const step = ref<"view-children" | "view-pros">("view-children");

const childrenPlanning = ref<ChildrenPlanning | null>(null);

const prosPlanning = ref<ProsPlanning | null>(null);

const roulements = ref<Roulements | null>(null);

const successMessage = ref<string | null>(null);

type localSave = {
  version: number;
  childrenPlanning: ChildrenPlanning;
  prosPlanning: ProsPlanning;
  roulements: Roulements | null;
};

const currentVersion = 1;

function save() {
  window.localStorage.setItem(
    "local-save",
    JSON.stringify({
      version: currentVersion,
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
  // avoid errors due to internal format chaange
  if (localSave.version != currentVersion) return;

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
  save();
}

function editDetachementsPros(week: int, detachements: (Detachement | null)[]) {
  if (!prosPlanning.value) return;
  const l = prosPlanning.value.weeks[week].prosHoraires;
  if (l.length != detachements.length) return; // should not happen
  detachements.forEach((v, i) => (l[i].detachement = v));
  successMessage.value = "Détachements modifiés avec succès.";
  save();
}
</script>
