<template>
  <v-container fluid>
    <FilesLoader></FilesLoader>
    <!-- <EnfantsCalendar :planning="tmpPlanning"></EnfantsCalendar> -->
  </v-container>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import { Enfants, type PlanningChildren } from "@/logic/enfants";
import "@/wasm_exec";
import EnfantsCalendar from "./components/EnfantsCalendar.vue";

import sample_pdf_content from "./logic/sample_enfants_off.json";
import FilesLoader from "./components/FilesLoader.vue";

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

const tmpPlanning = Enfants.parsePDFEnfants(
  sample_pdf_content
) as PlanningChildren;

onMounted(initWasm);

async function initWasm() {
  const go = new Go();
  const result = await WebAssembly.instantiateStreaming(
    fetch("main.wasm"),
    go.importObject
  );
  go.run(result.instance);
  console.log("OK");
}
</script>
