<template>
  <v-container fluid>
    <FilesLoader
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
    ></FilesLoader>
    <ChildrenCalendar
      v-else-if="step == 'view-children'"
      @go-back="step = 'load-files'"
      @go-next="step = 'view-pros'"
      :planning="childrenPlanning"
      @update="
        (p) => {
          childrenPlanning = p;
          save();
        }
      "
    ></ChildrenCalendar>
    <ProsCalendar
      v-else-if="step == 'view-pros'"
      :planning-children="childrenPlanning"
      :planning-pros="prosPlanning"
      :roulements="roulements"
      @edit-horaires="editHorairesPros"
      @edit-detachements="editDetachementsPros"
      @go-back="step = 'view-children'"
    ></ProsCalendar>

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

import FilesLoader from "./components/FilesLoader.vue";
import ChildrenCalendar from "./components/ChildrenCalendar.vue";
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

onMounted(load);

const step = ref<"load-files" | "view-children" | "view-pros">("load-files");

const childrenPlanning = ref<ChildrenPlanning>({
  firstMonday: new Date(),
  children: [],
  weekCount: 0,
});

const prosPlanning = ref<ProsPlanning>({
  firstMonday: new Date(),
  weeks: [],
});

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
  const l = prosPlanning.value.weeks[day.week].prosHoraires;
  if (l.length != horaires.length) return; // should not happen
  horaires.forEach((v, i) => (l[i].horaires[day.day] = v));
  successMessage.value = "Horaires modifiés avec succès.";
  save();
}

function editDetachementsPros(week: int, detachements: (Detachement | null)[]) {
  const l = prosPlanning.value.weeks[week].prosHoraires;
  if (l.length != detachements.length) return; // should not happen
  detachements.forEach((v, i) => (l[i].detachement = v));
  successMessage.value = "Détachements modifiés avec succès.";
  save();
}
</script>
