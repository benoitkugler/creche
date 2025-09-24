<template>
  <v-container fluid>
    <FilesLoader
      v-if="step == 'load-files'"
      @go-next="
        (c, p) => {
          planningChildren = c;
          planningPros = p;
          step = 'view-children';
          showSuccess = true;
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
      @go-back="step = 'view-children'"
      :planning-children="planningChildren"
      :planning-pros="planningPros"
    ></ProsCalendar>

    <v-snackbar v-model="showSuccess" :timeout="3000" color="green">
      Fichiers importés avec succès.
    </v-snackbar>
  </v-container>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import "@/wasm_exec";

import FilesLoader from "./components/FilesLoader.vue";
import type { PlanningChildren } from "./logic/enfants";
import type { PlanningPros } from "./logic/personnel";
import ChildrenCalendar from "./components/ChildrenCalendar.vue";
import { fromJson } from "./logic/shared";
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

const showSuccess = ref(false);

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
</script>
