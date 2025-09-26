<template>
  <v-container fluid>
    <FilesLoader
      v-if="step == 'load-files'"
      @go-next="
        (c, p) => {
          planningChildren = c;
          planningPros = p;
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
      :planning="planningChildren"
      @update="(p) => (planningChildren = p)"
    ></ChildrenCalendar>
    <ProsCalendar
      v-else-if="step == 'view-pros'"
      :planning-children="planningChildren"
      :planning-pros="planningPros"
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
import "@/wasm_exec";

import FilesLoader from "./components/FilesLoader.vue";
import type { PlanningChildren } from "./logic/enfants";
import type {
  Detachement,
  HoraireTravail,
  PlanningPros,
} from "./logic/personnel";
import ChildrenCalendar from "./components/ChildrenCalendar.vue";
import { fromJson, type DayIndex, type int } from "./logic/shared";
import ProsCalendar from "./components/ProsCalendar.vue";

/**
 * Go is the class as defined in the Golang `wasm_exec.js` distributable file required for WebAssembly.
 * Golang WebAssembly wiki: https://github.com/golang/go/wiki/WebAssembly
 */
declare class Go {
  argv: string[];
  env: { [envKey: string]: string };
  exit: (code: number) => void;
  importObject: WebAssembly.Imports;
  exited: boolean;
  mem: DataView;
  run(instance: WebAssembly.Instance): Promise<void>;
}

declare global {
  // go function returning TextBlock[] as JSON string
  interface Window {
    readPDFFile(slice: Uint8Array): string;
  }
}

onMounted(() => {
  load();
  initWasm();
});

const step = ref<"load-files" | "view-children" | "view-pros">("load-files");

const planningChildren = ref<PlanningChildren>({
  firstMonday: new Date(),
  enfants: [],
});

const planningPros = ref<PlanningPros>({
  firstMonday: new Date(),
  semaines: [],
});

const successMessage = ref<string | null>(null);

async function initWasm() {
  const go = new Go();
  const result = await WebAssembly.instantiateStreaming(
    fetch("main.wasm"),
    go.importObject
  );
  go.run(result.instance);
}

function save() {
  window.localStorage.setItem(
    "planningChildren",
    JSON.stringify(planningChildren.value)
  );
  window.localStorage.setItem(
    "planningPros",
    JSON.stringify(planningPros.value)
  );
}

function load() {
  const jsonC = window.localStorage.getItem("planningChildren");
  const jsonP = window.localStorage.getItem("planningPros");
  if (jsonP == null || jsonC == null) return;
  planningChildren.value = fromJson(jsonC) as PlanningChildren;
  planningPros.value = fromJson(jsonP) as PlanningPros;
  step.value = "view-children";
}

function editHorairesPros(day: DayIndex, horaires: HoraireTravail[]) {
  const l = planningPros.value.semaines[day.week].prosHoraires;
  if (l.length != horaires.length) return; // should not happen
  horaires.forEach((v, i) => (l[i].horaires[day.day] = v));
  successMessage.value = "Horaires modifiés avec succès.";
  save();
}

function editDetachementsPros(
  week: int,
  detachements: (Detachement | undefined)[]
) {
  const l = planningPros.value.semaines[week].prosHoraires;
  if (l.length != detachements.length) return; // should not happen
  detachements.forEach((v, i) => (l[i].detachement = v));
  successMessage.value = "Détachements modifiés avec succès.";
  save();
}
</script>
